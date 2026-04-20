from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio

# FastAPI app
fastapi_app = FastAPI()

# Socket.IO setup
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
app = socketio.ASGIApp(sio, fastapi_app)

members = {}

@sio.event
async def connect(sid, environ):
    print(f"Connected: {sid}")

@sio.event
async def share_location(sid, data):
    members[sid] = data
    await sio.emit('location_update', data, skip_sid=sid)

@sio.event
async def sos_alert(sid, data):
    await sio.emit('sos_alert', data)

@sio.event
async def disconnect(sid):
    if sid in members:
        del members[sid]
