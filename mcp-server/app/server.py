#!/usr/bin/env python3
"""
Lavender MCP Server
Model Context Protocol server for managing the LavenderTown homelab stacks
and Docker services. Designed for local AI agents to operate the homelab.
"""

import asyncio
import json
import os
import subprocess
from typing import Any

import docker
import uvicorn
from mcp.server import Server
from mcp.server.sse import SseServerTransport
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Mount, Route

# Known stacks (mirrors stacks/ layout and lavender-dashboard config)
KNOWN_STACKS = [
    "bigstackd",
    "infra",
    "databases",
    "media",
    "mailserver",
    "lavender-dashboard",
    "mcp",
    "system",
]

STACKS_DIR = os.environ.get("STACKS_DIR", "/stacks")

client = docker.from_env()
server = Server("lavender-mcp")


def _run_compose(stack: str, *args: str) -> str:
    """Run docker compose for a known stack."""
    compose_file = os.path.join(STACKS_DIR, stack, "docker-compose.yml")
    if not os.path.exists(compose_file):
        # Fallback for stacks that may use compose.yaml
        compose_file = os.path.join(STACKS_DIR, stack, "compose.yaml")
    if not os.path.exists(compose_file):
        return f"Error: No compose file found for stack '{stack}' at {compose_file}"

    cmd = ["docker", "compose", "-p", stack, "-f", compose_file, *args]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
        )
        output = result.stdout + result.stderr
        if result.returncode != 0:
            return f"Command failed (code {result.returncode}):\n{output}"
        return output or "Success (no output)"
    except subprocess.TimeoutExpired:
        return "Error: Command timed out"
    except Exception as e:
        return f"Error running compose: {str(e)}"


def _get_stack_from_container(container) -> str:
    labels = container.labels or {}
    return labels.get("com.docker.compose.project", "system")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="list_stacks",
            description="List all known homelab stacks with running container counts and status summary.",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="manage_stack",
            description="Perform an action on a homelab stack or specific service: up, down, restart, or pull. Destructive actions (down/restart) require force=true. Use dry_run=true first for preview.",
            inputSchema={
                "type": "object",
                "properties": {
                    "stack": {
                        "type": "string",
                        "description": f"Stack name. One of: {', '.join(KNOWN_STACKS)}",
                    },
                    "action": {
                        "type": "string",
                        "enum": ["up", "down", "restart", "pull"],
                        "description": "Action to perform",
                    },
                    "service": {
                        "type": "string",
                        "description": "Optional service name within the stack for per-service control (e.g. 'jellyfin'). If omitted, affects the whole stack.",
                    },
                    "dry_run": {
                        "type": "boolean",
                        "description": "If true, preview the action without executing (uses --dry-run where supported).",
                        "default": False,
                    },
                    "force": {
                        "type": "boolean",
                        "description": "Must be true for destructive actions (down, restart) to actually execute.",
                        "default": False,
                    },
                },
                "required": ["stack", "action"],
            },
        ),
        Tool(
            name="list_containers",
            description="List Docker containers, optionally filtered by stack.",
            inputSchema={
                "type": "object",
                "properties": {
                    "stack": {
                        "type": "string",
                        "description": "Optional stack filter",
                    }
                },
            },
        ),
        Tool(
            name="get_logs",
            description="Get recent logs from a specific container.",
            inputSchema={
                "type": "object",
                "properties": {
                    "container": {"type": "string", "description": "Container name or ID"},
                    "lines": {"type": "integer", "description": "Number of lines (default 100)"},
                },
                "required": ["container"],
            },
        ),
        Tool(
            name="system_status",
            description="Get basic system resource overview (CPU, memory, disk).",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="restart_service",
            description="Restart a specific service in a stack. Requires force=true for execution (use dry_run first).",
            inputSchema={
                "type": "object",
                "properties": {
                    "stack": {"type": "string", "description": f"Stack name. One of: {', '.join(KNOWN_STACKS)}"},
                    "service": {"type": "string", "description": "Service name (e.g. 'jellyfin')"},
                    "dry_run": {"type": "boolean", "default": False},
                    "force": {"type": "boolean", "default": False},
                },
                "required": ["stack", "service"],
            },
        ),
        Tool(
            name="stop_service",
            description="Stop a specific service in a stack. Requires force=true.",
            inputSchema={
                "type": "object",
                "properties": {
                    "stack": {"type": "string", "description": f"Stack name. One of: {', '.join(KNOWN_STACKS)}"},
                    "service": {"type": "string", "description": "Service name"},
                    "dry_run": {"type": "boolean", "default": False},
                    "force": {"type": "boolean", "default": False},
                },
                "required": ["stack", "service"],
            },
        ),
        Tool(
            name="start_service",
            description="Start a specific service in a stack.",
            inputSchema={
                "type": "object",
                "properties": {
                    "stack": {"type": "string", "description": f"Stack name. One of: {', '.join(KNOWN_STACKS)}"},
                    "service": {"type": "string", "description": "Service name"},
                    "dry_run": {"type": "boolean", "default": False},
                },
                "required": ["stack", "service"],
            },
        ),
        Tool(
            name="plan_action",
            description="Preview/plan a stack or service action without executing. Returns a safe description of what would happen. Use this before calling manage_stack or service tools with force.",
            inputSchema={
                "type": "object",
                "properties": {
                    "stack": {"type": "string", "description": f"Stack name. One of: {', '.join(KNOWN_STACKS)}"},
                    "action": {"type": "string", "enum": ["up", "down", "restart", "pull"]},
                    "service": {"type": "string", "description": "Optional service name"},
                },
                "required": ["stack", "action"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    try:
        if name == "list_stacks":
            containers = client.containers.list(all=True)
            stacks: dict[str, list] = {}
            for c in containers:
                s = _get_stack_from_container(c)
                if s not in stacks:
                    stacks[s] = []
                stacks[s].append({
                    "name": c.name,
                    "status": c.status,
                })

            summary = []
            for stack in KNOWN_STACKS:
                ctrs = stacks.get(stack, [])
                running = sum(1 for c in ctrs if c["status"] == "running")
                summary.append(f"{stack}: {len(ctrs)} containers ({running} running)")

            # Include any unknown stacks
            for s, ctrs in stacks.items():
                if s not in KNOWN_STACKS:
                    running = sum(1 for c in ctrs if c["status"] == "running")
                    summary.append(f"{s} (unknown): {len(ctrs)} containers ({running} running)")

            return [TextContent(type="text", text="\n".join(summary))]

        elif name == "manage_stack":
            stack = arguments["stack"]
            action = arguments["action"]
            service = arguments.get("service")
            dry_run = arguments.get("dry_run", False)
            force = arguments.get("force", False)

            if stack not in KNOWN_STACKS:
                return [TextContent(type="text", text=f"Unknown stack: {stack}. Known: {KNOWN_STACKS}")]

            # Safety: require force for destructive actions unless dry_run
            destructive = action in ["down", "restart"]
            if destructive and not dry_run and not force:
                return [TextContent(type="text", text=(
                    f"Destructive action '{action}' on stack '{stack}' requires force=true or dry_run=true first. "
                    "Use dry_run=true to preview what would happen."
                ))]

            cmd_args = [action]
            if action == "up":
                cmd_args.append("-d")
            if service:
                cmd_args.append(service)
            if dry_run:
                # --dry-run works for up/down/pull in modern compose; restart may simulate via plan
                cmd_args.append("--dry-run")

            target = f"'{stack}'" + (f" service '{service}'" if service else "")
            if dry_run:
                cmd_str = "docker compose -p " + stack + " -f <compose-file> " + " ".join(cmd_args)
                return [TextContent(type="text", text=f"[DRY-RUN] Would run: {cmd_str} on {target}")]
            output = _run_compose(stack, *cmd_args)
            prefix = ""
            return [TextContent(type="text", text=f"Action '{action}' on {target}:\n{output}")]

        elif name == "restart_service":
            stack = arguments["stack"]
            service = arguments["service"]
            dry_run = arguments.get("dry_run", False)
            force = arguments.get("force", False)
            if stack not in KNOWN_STACKS:
                return [TextContent(type="text", text=f"Unknown stack: {stack}")]
            if not dry_run and not force:
                return [TextContent(type="text", text="restart_service requires force=true or dry_run=true")]
            if dry_run:
                return [TextContent(type="text", text=f"[DRY-RUN] Would restart service '{service}' in '{stack}' (compose restart {service})")]
            output = _run_compose(stack, "restart", service)
            return [TextContent(type="text", text=f"Restarted service '{service}' in '{stack}':\n{output}")]

        elif name == "stop_service":
            stack = arguments["stack"]
            service = arguments["service"]
            dry_run = arguments.get("dry_run", False)
            force = arguments.get("force", False)
            if stack not in KNOWN_STACKS:
                return [TextContent(type="text", text=f"Unknown stack: {stack}")]
            if not dry_run and not force:
                return [TextContent(type="text", text="stop_service requires force=true or dry_run=true")]
            if dry_run:
                return [TextContent(type="text", text=f"[DRY-RUN] Would stop service '{service}' in '{stack}' (compose stop {service})")]
            output = _run_compose(stack, "stop", service)
            return [TextContent(type="text", text=f"Stopped service '{service}' in '{stack}':\n{output}")]

        elif name == "start_service":
            stack = arguments["stack"]
            service = arguments["service"]
            dry_run = arguments.get("dry_run", False)
            if stack not in KNOWN_STACKS:
                return [TextContent(type="text", text=f"Unknown stack: {stack}")]
            if dry_run:
                return [TextContent(type="text", text=f"[DRY-RUN] Would start service '{service}' in '{stack}' (compose start {service})")]
            output = _run_compose(stack, "start", service)
            return [TextContent(type="text", text=f"Started service '{service}' in '{stack}':\n{output}")]

        elif name == "plan_action":
            stack = arguments["stack"]
            action = arguments["action"]
            service = arguments.get("service")
            if stack not in KNOWN_STACKS:
                return [TextContent(type="text", text=f"Unknown stack: {stack}")]
            target = f"stack '{stack}'" + (f" service '{service}'" if service else "")
            cmd = [action]
            if action == "up":
                cmd.append("-d")
            if service:
                cmd.append(service)
            if action in ["down", "pull"]:
                cmd.append("--dry-run")
            cmd_str = "docker compose -p " + stack + " -f <compose-file> " + " ".join(cmd)
            desc = f"Would run: {cmd_str}"
            if action == "restart":
                desc += " (restart does not support --dry-run; this is a simulated preview)"
            return [TextContent(type="text", text=f"PLAN for {action} on {target}:\n{desc}\n\nTo execute, call manage_stack / the service tool with force=true (after reviewing).")]

        elif name == "list_containers":
            stack_filter = arguments.get("stack")
            containers = client.containers.list(all=True)
            result = []
            for c in containers:
                stack = _get_stack_from_container(c)
                if stack_filter and stack != stack_filter:
                    continue
                result.append({
                    "name": c.name,
                    "stack": stack,
                    "image": (c.image.tags[0] if c.image.tags else c.attrs.get("Config", {}).get("Image", "unknown")),
                    "status": c.status,
                })
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        elif name == "get_logs":
            container_name = arguments["container"]
            lines = arguments.get("lines", 100)
            try:
                ctr = client.containers.get(container_name)
                logs = ctr.logs(tail=lines, timestamps=True).decode("utf-8", errors="replace")
                return [TextContent(type="text", text=logs[-8000:] if len(logs) > 8000 else logs)]  # truncate
            except Exception as e:
                return [TextContent(type="text", text=f"Error getting logs: {e}")]

        elif name == "system_status":
            # Lightweight version of dashboard system collector
            import psutil
            cpu = psutil.cpu_percent(interval=0.2)
            mem = psutil.virtual_memory()
            try:
                disk = psutil.disk_usage('/')
                disk_info = {
                    "disk_percent": disk.percent,
                    "disk_used_human": f"{disk.used / (1024**3):.1f}GB",
                    "disk_total_human": f"{disk.total / (1024**3):.1f}GB",
                }
            except Exception:
                disk_info = {}
            return [TextContent(type="text", text=json.dumps({
                "cpu_percent": cpu,
                "memory_percent": mem.percent,
                "memory_used_human": f"{mem.used / (1024**3):.1f}GB",
                "memory_total_human": f"{mem.total / (1024**3):.1f}GB",
                **disk_info,
            }, indent=2))]

        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Tool error: {str(e)}")]


async def main():
    transport = os.environ.get("MCP_TRANSPORT", "stdio")
    if transport == "stdio":
        async with stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                server.create_initialization_options(),
            )
    else:
        # HTTP SSE transport for remote/local HTTP connections
        sse = SseServerTransport("/messages/")

        async def handle_sse(request: Request):
            async with sse.connect_sse(
                request.scope, request.receive, request._send
            ) as (read_stream, write_stream):
                await server.run(
                    read_stream,
                    write_stream,
                    server.create_initialization_options(),
                )
            return Response()

        starlette_app = Starlette(
            debug=True,
            routes=[
                Route("/sse", endpoint=handle_sse),
                Mount("/messages/", app=sse.handle_post_message),
            ],
        )

        host = os.environ.get("MCP_HOST", "0.0.0.0")
        port = int(os.environ.get("MCP_PORT", "8765"))
        config = uvicorn.Config(starlette_app, host=host, port=port, log_level="info")
        server_instance = uvicorn.Server(config)
        await server_instance.serve()


if __name__ == "__main__":
    asyncio.run(main())
