import docker
from datetime import datetime, timezone


client = docker.from_env()


def _parse_uptime(started_at: str) -> str:
    try:
        started = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - started
        days = delta.days
        hours, remainder = divmod(delta.seconds, 3600)
        minutes, _ = divmod(remainder, 60)
        if days > 0:
            return f"{days}d {hours}h"
        if hours > 0:
            return f"{hours}h {minutes}m"
        return f"{minutes}m"
    except Exception:
        return "unknown"


def _get_stack(container) -> str:
    labels = container.labels or {}
    return labels.get("com.docker.compose.project", "system")


def _get_health(container) -> str:
    try:
        state = container.attrs.get("State", {})
        health = state.get("Health", {})
        return health.get("Status", "none")
    except Exception:
        return "none"


def collect() -> dict:
    containers = client.containers.list(all=True)
    stacks = {}

    for c in containers:
        stack = _get_stack(c)
        state = c.attrs.get("State", {})

        info = {
            "name": c.name,
            "image": c.image.tags[0] if c.image.tags else c.attrs.get("Config", {}).get("Image", "unknown"),
            "status": c.status,
            "health": _get_health(c),
            "uptime": _parse_uptime(state.get("StartedAt", "")),
            "started_at": state.get("StartedAt", ""),
            "stack": stack,
        }

        if stack not in stacks:
            stacks[stack] = []
        stacks[stack].append(info)

    # Sort containers within each stack by name
    for stack in stacks:
        stacks[stack].sort(key=lambda x: x["name"])

    return stacks
