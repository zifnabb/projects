# lavender-mcp

MCP (Model Context Protocol) server for the LavenderTown homelab.

Provides tools for local AI agents to list, inspect, and manage Docker containers and the defined Compose stacks.

## Development

```bash
cd mcp-server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.server
```

## Docker

See `stacks/mcp/README.md` for the full deployment plan (including HTTP transport enablement and SSH/HTTP connection methods).

## Tools

See [stacks/mcp/README.md](../stacks/mcp/README.md) for the full list of tools and usage with AI clients.
