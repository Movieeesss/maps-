from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio

# 1. Create FastAPI app
app = FastAPI()

# 2. CORS Configuration (Allowing your Vercel frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production-la unga vercel URL mattum kudukalam
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Create Socket.IO Server
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

# --- Tracking Logic ---
members = {}

@sio.event
async def connect(sid, environ):
    print(f"Member Connected: {sid}")

@sio.event
async def disconnect(sid):
    if sid in members:
        del members[sid]
    print(f"Member Disconnected: {sid}")

@sio.event
async def share_location(sid, data):
    # Data format: { id, name, lat, lng, lastUpdated }
    members[sid] = data
    # Broadcast this location to ALL other online members
    await sio.emit('location_update', data)

@sio.event
async def sos_alert(sid, data):
    # Broadcast SOS to everyone immediately
    await sio.emit('sos_alert', data)

# 4. Mount Socket.IO to FastAPI
app.mount("/", socket_app)
