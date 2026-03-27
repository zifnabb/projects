import asyncio
import json

from fastapi import FastAPI
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.collectors import containers, system
from app import config

app = FastAPI(title="LavenderTown Dashboard")

static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
async def index():
    return FileResponse(static_dir / "index.html")


@app.get("/api/system")
async def get_system():
    return system.collect()


@app.get("/api/containers")
async def get_containers():
    return containers.collect()


@app.get("/api/topology")
async def get_topology():
    return {
        "hostname": config.HOSTNAME,
        "domain": config.DOMAIN,
        "server_ip": config.SERVER_IP,
        "stacks": config.STACKS,
        "subdomains": config.SUBDOMAINS,
        "internal_services": config.INTERNAL_SERVICES,
        "no_link": config.NO_LINK,
        "container_links": {
            s["container"]: f"https://{s['subdomain']}.{config.DOMAIN}"
            for s in config.SUBDOMAINS
            if s["container"] not in config.NO_LINK
               and s["container"] not in config.INTERNAL_SERVICES
        },
    }


@app.get("/api/events")
async def events():
    async def generator():
        while True:
            try:
                sys_data = system.collect()
                yield f"event: system\ndata: {json.dumps(sys_data)}\n\n"
            except Exception as e:
                yield f"event: error\ndata: {json.dumps({'error': str(e), 'source': 'system'})}\n\n"

            await asyncio.sleep(5)

            try:
                ctr_data = containers.collect()
                yield f"event: containers\ndata: {json.dumps(ctr_data)}\n\n"
            except Exception as e:
                yield f"event: error\ndata: {json.dumps({'error': str(e), 'source': 'containers'})}\n\n"

            await asyncio.sleep(5)

    return StreamingResponse(generator(), media_type="text/event-stream")
