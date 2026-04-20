from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio

# 1. FastAPI app create pandrom
fastapi_app = FastAPI()

# 2. CORS setting - idhu dhaan Maps.tsx and API-a link pannum
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Socket.IO setup
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

# 4. CRITICAL: Intha 'app' variable dhaan Vercel-ku 'Main Switch'
# Idhu dhaan FastAPI-aiyum Socket.IO-vaiyum onnu saerukkum
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)

# --- Live Tracking Logic ---
members = {}

@sio.event
async def connect(sid, environ):
    print(f"Connected: {sid}")

@sio.event
async def share_location(sid, data):
    # Members list-la data-va store panni broadcast pannum
    members[sid] = data
    await sio.emit('location_update', data, skip_sid=sid)

@sio.event
async def sos_alert(sid, data):
    # Emergency SOS alert logic
    await sio.emit('sos_alert', data)

@sio.event
async def disconnect(sid):
    # Member leave aana list-la irundhu remove pannidum
    if sid in members:
        del members[sid]
