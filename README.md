# Society Live Tracker – Complete Setup Guide

## Why the screen was blank (Root Cause Fix)
The blank screen was caused by **3 issues**:
1. `leaflet/dist/leaflet.css` was NOT imported in `main.tsx` — map renders blank without it
2. Leaflet's default marker icons break in Vite (webpack asset path issue) — fixed with `L.Icon.Default.mergeOptions()`  
3. `react-leaflet` v5 has breaking changes — downgraded to stable **v4.2.1** in package.json

---

## Project File Structure
```
maps-app/
├── public/
│   ├── manifest.json     ✅ Updated for Society Tracker
│   ├── sw.js             ✅ Cache-first offline support
│   ├── offline.html
│   └── icon-*.png        (keep from previous project)
├── src/
│   ├── Maps.tsx          ✅ Complete rewrite
│   ├── main.tsx          ✅ Fixed import + leaflet CSS
│   └── style.css         ✅ Tailwind + Leaflet overrides
├── backend/
│   ├── backend.py        ✅ FastAPI + Socket.IO server
│   └── requirements.txt
├── index.html            ✅ Corrected title
├── vite.config.ts        ✅ Leaflet asset handling fixed
└── package.json          ✅ react-leaflet v4 (stable)
```

---

## Step 1 – Update Your GitHub Repo

Replace these files in your repo with the new versions:
- `src/Maps.tsx`
- `src/main.tsx`  
- `src/style.css`
- `index.html`
- `vite.config.ts`
- `package.json`
- `public/manifest.json`

---

## Step 2 – Set Your Society GPS Coordinates

In `src/Maps.tsx`, find these lines and update to your actual society location:

```typescript
// Line ~100 — Default map center
const [myPos, setMyPos] = useState<[number, number]>([10.7905, 78.7047]);

// Lines ~40-65 — Safety zones (add your real structural issue coordinates)
const SAFETY_ZONES: SafetyZone[] = [
  {
    id: 'sz1',
    label: 'Zone A – Weak Retaining Wall',
    lat: 10.7910,   // ← Change to your GPS
    lng: 78.7055,   // ← Change to your GPS
    radius: 25,     // metres
    severity: 'critical',
    description: 'Cracked retaining wall. Do not approach during rain.',
  },
  // Add more zones...
];
```

**How to get GPS coordinates:** Open Google Maps → Long press any location → Coordinates appear at top.

---

## Step 3 – Deploy the Python Backend

### Option A – Railway (Recommended, Free Tier)
1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Create a new repo with just the `backend/` folder contents
3. Set start command: `uvicorn backend:app --host 0.0.0.0 --port $PORT`
4. Copy your Railway URL (e.g., `https://society-tracker.up.railway.app`)

### Option B – Render (Free)
1. Go to [render.com](https://render.com) → New Web Service
2. Connect your backend repo
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn backend:app --host 0.0.0.0 --port $PORT`

### Local testing
```bash
cd backend
pip install -r requirements.txt
uvicorn backend:app --reload
# Backend runs at http://localhost:8000
```

---

## Step 4 – Connect Frontend to Backend

In your Vercel project settings, add an environment variable:

| Name | Value |
|------|-------|
| `VITE_BACKEND_URL` | `https://your-railway-app.up.railway.app` |

Also update Railway's `ALLOWED_ORIGINS` env var:
```
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
```

---

## Step 5 – Deploy Frontend to Vercel

```bash
# In your repo root
npm install
npm run build   # Should complete with 0 errors
# Then push to GitHub — Vercel auto-deploys
```

---

## How to Add Family Members

Each person installs the PWA on their phone and opens it. Their `share_location` event uses their name. To set a custom name, edit this line in `Maps.tsx`:

```typescript
socketRef.current?.emit('share_location', {
  id: 'prakash_m',     // ← Unique ID per person
  name: 'Prakash M',   // ← Their display name
  ...
```

For a multi-user setup, prompt the user for their name on first open and store it in `localStorage`.

---

## Features Implemented

| Feature | Status |
|---------|--------|
| Live GPS tracking (watchPosition) | ✅ |
| Socket.IO real-time broadcast | ✅ |
| Safety zone detection (Haversine) | ✅ |
| Visual danger zone circles on map | ✅ |
| Alert toast when entering zone | ✅ |
| Follow mode (smooth flyTo) | ✅ |
| SOS emergency broadcast | ✅ |
| Drag-to-reorder member list (@dnd-kit) | ✅ |
| Safety dashboard overlay | ✅ |
| PWA offline support | ✅ |
| Android APK via PWABuilder | ✅ |
