import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { io, Socket } from 'socket.io-client';
import {
  DndContext,
  closestCenter,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Fix Leaflet default icon (Optimized for Vite Build) ---
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

if (L.Icon.Default.prototype) {
  (L.Icon.Default.prototype as any)._getIconUrl = undefined;
  L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// --- Types ---
interface MemberLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lastUpdated: string;
  inDangerZone?: boolean;
}

interface SafetyZone {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radius: number;
  severity: 'warning' | 'critical';
  description: string;
}

const SAFETY_ZONES: SafetyZone[] = [
  { id: 'sz1', label: 'Zone A – Weak Retaining Wall', lat: 10.7910, lng: 78.7055, radius: 25, severity: 'critical', description: 'Cracked retaining wall. Do not approach during rain.' },
  { id: 'sz2', label: 'Zone B – Under Repair Slab', lat: 10.7895, lng: 78.7040, radius: 20, severity: 'warning', description: 'Overhead slab under repair. Wear helmet.' },
  { id: 'sz3', label: 'Zone C – Waterlogging Area', lat: 10.7920, lng: 78.7030, radius: 30, severity: 'warning', description: 'Poor drainage. Risk of slipping.' },
];

// --- Custom Icons ---
function createDivIcon(color: string, letter: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:36px;height:36px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:white;font-family:sans-serif;">${letter}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

const myIcon = createDivIcon('#0070c0', '✦');
const memberIcon = (name: string, danger: boolean) => createDivIcon(danger ? '#dc2626' : '#16a34a', name[0].toUpperCase());

// --- Haversine logic (Prakash Precision) ---
function distanceMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isInAnyZone(lat: number, lng: number): boolean {
  return SAFETY_ZONES.some((z) => distanceMetres(lat, lng, z.lat, z.lng) <= z.radius);
}

function nearestZone(lat: number, lng: number): SafetyZone | null {
  let nearest: SafetyZone | null = null;
  let minDist = Infinity;
  for (const z of SAFETY_ZONES) {
    const d = distanceMetres(lat, lng, z.lat, z.lng);
    if (d <= z.radius && d < minDist) { minDist = d; nearest = z; }
  }
  return nearest;
}

// --- Map Controller ---
function MapController({ position, follow }: { position: [number, number]; follow: boolean }) {
  const map = useMap();
  const prevPos = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!follow) return;
    if (!prevPos.current) { map.setView(position, 16, { animate: false }); prevPos.current = position; return; }
    const moved = distanceMetres(prevPos.current[0], prevPos.current[1], position[0], position[1]);
    if (moved > 8) {
      map.flyTo(position, map.getZoom(), { animate: true, duration: 1.2 });
      prevPos.current = position;
    }
  }, [position, follow, map]);
  return null;
}

// --- Sortable Member Card (Touch Sensor Logic) ---
function MemberCard({ member }: { member: MemberLocation }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: member.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.75 : 1, zIndex: isDragging ? 50 : 'auto' };

  const ago = (() => {
    const s = Math.floor((Date.now() - new Date(member.lastUpdated).getTime()) / 1000);
    return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
  })();

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${member.inDangerZone ? 'bg-red-50 border-red-300 shadow-red-100' : 'bg-white border-slate-200'} shadow-sm mb-2 select-none`}>
      <div {...attributes} {...listeners} className="text-slate-300 cursor-grab active:cursor-grabbing px-1" style={{ touchAction: 'none' }}>☰</div>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0 ${member.inDangerZone ? 'bg-red-500' : 'bg-green-600'}`}>{member.name[0].toUpperCase()}</div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800 text-sm leading-tight truncate">{member.name}</p>
        <p className="text-[10px] text-slate-400">{ago}</p>
      </div>
      {member.inDangerZone ? <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex-shrink-0 animate-pulse">⚠ ZONE</span> : <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full flex-shrink-0">✓ SAFE</span>}
    </div>
  );
}

export default function SocietyMaps() {
  const [myPos, setMyPos] = useState<[number, number]>([10.7905, 78.7047]);
  const [members, setMembers] = useState<MemberLocation[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [follow, setFollow] = useState(true);
  const [myDanger, setMyDanger] = useState(false);
  const [activeZone, setActiveZone] = useState<SafetyZone | null>(null);
  const [showPanel, setShowPanel] = useState(true);
  const [alert, setAlert] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const alertTimeout = useRef<any>(null);

  const showAlert = useCallback((msg: string) => {
    setAlert(msg);
    if (alertTimeout.current) clearTimeout(alertTimeout.current);
    alertTimeout.current = setTimeout(() => setAlert(null), 5000);
  }, []);

  useEffect(() => {
    const sock = io(BACKEND_URL, { transports: ['websocket'], reconnectionDelay: 2000 });
    socketRef.current = sock;
    sock.on('connect', () => setIsConnected(true));
    sock.on('disconnect', () => setIsConnected(false));
    sock.on('location_update', (data: MemberLocation) => {
      const inZone = isInAnyZone(data.lat, data.lng);
      const enriched: MemberLocation = { ...data, inDangerZone: inZone };
      setMembers((prev) => {
        const idx = prev.findIndex((m) => m.id === data.id);
        if (idx === -1) return [...prev, enriched];
        const next = [...prev]; next[idx] = enriched; return next;
      });
      if (inZone) showAlert(`⚠ ${data.name} entered ${nearestZone(data.lat, data.lng)?.label ?? 'a safety zone'}!`);
    });
    sock.on('sos_alert', (data: { name: string; message: string }) => showAlert(`🆘 SOS from ${data.name}: ${data.message}`));
    return () => { sock.disconnect(); };
  }, [showAlert]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition((pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      setMyPos([lat, lng]);
      const inZone = isInAnyZone(lat, lng);
      const zone = nearestZone(lat, lng);
      if (inZone && !myDanger) showAlert(`⚠ You entered: ${zone?.label}. ${zone?.description}`);
      setMyDanger(inZone); setActiveZone(zone);
      socketRef.current?.emit('share_location', { id: 'me', name: 'Me', lat, lng, lastUpdated: new Date().toISOString() });
    }, (err) => console.error(err), { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [myDanger, showAlert]);

  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }));
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setMembers((items) => {
        const oi = items.findIndex((i) => i.id === active.id);
        const ni = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oi, ni);
      });
    }
  };

  const sendSOS = () => {
    socketRef.current?.emit('sos_alert', { name: 'Me', message: 'EMERGENCY!', lat: myPos[0], lng: myPos[1] });
    showAlert('🆘 SOS Alert sent!');
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-slate-900">
      {alert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-[90vw] w-full px-4">
          <div className="bg-red-600 text-white rounded-2xl px-4 py-3 shadow-2xl flex items-start gap-3 animate-bounce">
            <span className="text-xl">🚨</span>
            <p className="text-sm font-bold leading-snug">{alert}</p>
            <button onClick={() => setAlert(null)} className="ml-auto text-white/70 hover:text-white text-lg leading-none">×</button>
          </div>
        </div>
      )}

      <header className="bg-[#0070c0] px-4 py-3 flex items-center gap-3 shadow-lg z-[1000] flex-shrink-0">
        <div className="bg-white/20 rounded-lg p-1.5 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div className="flex-1">
          <h1 className="text-white font-black text-base tracking-wide leading-none uppercase">Society Tracker</h1>
          <p className="text-blue-200 text-[10px] mt-0.5">Structural Safety Monitor</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-white/70 text-[10px] uppercase">{isConnected ? 'Live' : 'Off'}</span>
        </div>
        <button onClick={() => setFollow((f) => !f)} className={`ml-2 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${follow ? 'bg-white text-[#0070c0] border-white' : 'bg-transparent text-white border-white/40'}`}>
          {follow ? '⦿ FOLLOW' : '⊙ FREE'}
        </button>
      </header>

      {myDanger && activeZone && (
        <div className={`flex items-center gap-2 px-4 py-2 flex-shrink-0 ${activeZone.severity === 'critical' ? 'bg-red-600' : 'bg-amber-500'}`}>
          <span className="text-white text-base">⚠</span>
          <div className="flex-1 text-white">
            <p className="font-black text-xs">{activeZone.label}</p>
            <p className="text-[10px] opacity-80">{activeZone.description}</p>
          </div>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        <MapContainer center={myPos} zoom={17} zoomControl={false} className="h-full w-full">
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ZoomControl position="topright" />
          <MapController position={myPos} follow={follow} />

          {SAFETY_ZONES.map((zone) => (
            <Circle key={zone.id} center={[zone.lat, zone.lng]} radius={zone.radius} pathOptions={{ color: zone.severity === 'critical' ? '#dc2626' : '#f59e0b', fillColor: zone.severity === 'critical' ? '#fca5a5' : '#fde68a', fillOpacity: 0.35, weight: 2, dashArray: '6 4' }}>
              <Popup>
                <div className="font-sans p-1">
                  <p className="font-black text-sm" style={{ color: zone.severity === 'critical' ? '#dc2626' : '#d97706' }}>{zone.label}</p>
                  <p className="text-xs text-gray-600 mt-1">{zone.description}</p>
                </div>
              </Popup>
            </Circle>
          ))}

          <Marker position={myPos} icon={myIcon}><Popup><p className="font-bold text-[#0070c0]">📍 You are here</p></Popup></Marker>
          {members.map((m) => (<Marker key={m.id} position={[m.lat, m.lng]} icon={memberIcon(m.name, m.inDangerZone ?? false)}><Popup><p className="font-bold text-sm">{m.name}</p></Popup></Marker>))}
        </MapContainer>

        <button onClick={sendSOS} className="absolute top-4 left-4 z-[1000] w-14 h-14 rounded-full bg-red-600 text-white font-black text-xs shadow-2xl border-4 border-white flex flex-col items-center justify-center active:scale-95 transition-transform"><span className="text-base">🆘</span>SOS</button>
        <button onClick={() => setShowPanel((p) => !p)} className="absolute top-4 right-14 z-[1000] bg-[#0070c0] text-white text-[10px] font-bold px-3 py-2 rounded-xl shadow-lg">{showPanel ? '▼ PANEL' : '▲ PANEL'}</button>

        {showPanel && (
          <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-white/95 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-slate-200">
            <div className="flex justify-center pt-2 pb-1"><div className="w-10 h-1 bg-slate-300 rounded-full" /></div>
            <div className="grid grid-cols-3 gap-2 px-4 pb-3 pt-1">
              <div className="bg-[#0070c0]/10 rounded-xl p-2.5 text-center"><p className="text-[#0070c0] font-black text-xl leading-none">{members.length + 1}</p><p className="text-slate-500 text-[9px] font-bold mt-0.5 uppercase tracking-tighter">Tracking</p></div>
              <div className={`rounded-xl p-2.5 text-center ${(members.filter(m => m.inDangerZone).length + (myDanger ? 1 : 0)) > 0 ? 'bg-red-100' : 'bg-green-100'}`}><p className={`font-black text-xl leading-none ${(members.filter(m => m.inDangerZone).length + (myDanger ? 1 : 0)) > 0 ? 'text-red-600' : 'text-green-600'}`}>{(members.filter(m => m.inDangerZone).length + (myDanger ? 1 : 0))}</p><p className="text-slate-500 text-[9px] font-bold mt-0.5 uppercase tracking-tighter">In Zone</p></div>
              <div className="bg-amber-50 rounded-xl p-2.5 text-center"><p className="text-amber-600 font-black text-xl leading-none">{SAFETY_ZONES.length}</p><p className="text-slate-500 text-[9px] font-bold mt-0.5 uppercase tracking-tighter">Zones</p></div>
            </div>
            <div className="px-4 pb-4 max-h-48 overflow-y-auto">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Members — prioritize</p>
              {members.length === 0 ? <p className="text-slate-400 text-xs text-center py-3">Waiting for family to join...</p> : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={members.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                    {members.map((m) => <MemberCard key={m.id} member={m} />)}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
