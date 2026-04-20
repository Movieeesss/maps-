"""
Society Live Tracker – FastAPI + Socket.IO Backend
===================================================
Install:
    pip install fastapi "uvicorn[standard]" python-socketio

Run locally:
    uvicorn backend:app --host 0.0.0.0 --port 8000 --reload

Deploy to Railway / Render:
    1. Push this file as `backend.py` in your repo root
    2. Set start command: uvicorn backend:app --host 0.0.0.0 --port $PORT
    3. Set environment variable: ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
"""

import os
import time
import logging
from typing import Dict, Any

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
log = logging.getLogger("society-tracker")

# ── Allowed origins (set via environment variable on deploy) ──
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4173"   # local dev defaults
).split(",")

# ── Socket.IO server ──────────────────────────────────────────
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=ALLOWED_ORIGINS,
    logger=False,
    engineio_logger=False,
    ping_timeout=20,
    ping_interval=10,
)

# ── FastAPI app ───────────────────────────────────────────────
fastapi_app = FastAPI(title="Society Live Tracker API", version="1.0.0")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Combine FastAPI + Socket.IO ───────────────────────────────
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)

# ── In-memory store ───────────────────────────────────────────
# { socket_id: MemberLocation }
connected_members: Dict[str, Dict[str, Any]] = {}

# ── REST health endpoint ──────────────────────────────────────
@fastapi_app.get("/health")
async def health():
    return {
        "status": "ok",
        "connected": len(connected_members),
        "members": list(connected_members.values()),
    }


# ── Socket.IO Events ──────────────────────────────────────────

@sio.event
async def connect(sid: str, environ: dict, auth: dict = None):
    log.info(f"[+] Connected: {sid}")
    # Send existing member locations to the newly connected client
    for member in connected_members.values():
        await sio.emit("location_update", member, to=sid)


@sio.event
async def disconnect(sid: str):
    log.info(f"[-] Disconnected: {sid}")
    if sid in connected_members:
        member = connected_members.pop(sid)
        # Notify everyone this member left
        await sio.emit("member_left", {"id": member.get("id"), "name": member.get("name")})


@sio.event
async def share_location(sid: str, data: dict):
    """
    Expected payload from frontend:
    {
        "id": "unique_member_id",
        "name": "Prakash M",
        "lat": 10.7905,
        "lng": 78.7047,
        "lastUpdated": "2025-01-01T12:00:00.000Z"
    }
    """
    required = {"id", "name", "lat", "lng"}
    if not required.issubset(data.keys()):
        log.warning(f"Invalid share_location payload from {sid}: {data}")
        return

    # Validate coordinate ranges
    try:
        lat = float(data["lat"])
        lng = float(data["lng"])
        assert -90 <= lat <= 90
        assert -180 <= lng <= 180
    except (ValueError, AssertionError):
        log.warning(f"Invalid coordinates from {sid}")
        return

    payload = {
        "id": str(data["id"])[:64],
        "name": str(data["name"])[:64],
        "lat": lat,
        "lng": lng,
        "lastUpdated": data.get("lastUpdated") or time.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "socketId": sid,
    }

    connected_members[sid] = payload

    # Broadcast to ALL other connected clients (skip=sid means "all except sender")
    await sio.emit("location_update", payload, skip_sid=sid)
    log.debug(f"Broadcast location: {payload['name']} → ({lat:.4f}, {lng:.4f})")


@sio.event
async def sos_alert(sid: str, data: dict):
    """
    SOS emergency broadcast.
    Payload: { "name": str, "message": str, "lat": float, "lng": float }
    """
    payload = {
        "fromSocketId": sid,
        "name": str(data.get("name", "Unknown"))[:64],
        "message": str(data.get("message", "EMERGENCY"))[:256],
        "lat": data.get("lat"),
        "lng": data.get("lng"),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    }
    log.warning(f"🆘 SOS from {payload['name']}: {payload['message']}")
    # Broadcast to everyone including sender
    await sio.emit("sos_alert", payload)


# ── Run directly ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend:app", host="0.0.0.0", port=8000, reload=True)
