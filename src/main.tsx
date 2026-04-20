import React from 'react'
import ReactDOM from 'react-dom/client'
import SocietyMaps from './Maps'
import './style.css'
import 'leaflet/dist/leaflet.css'

// ── Service Worker Registration ──────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => console.log('[SW] Registered:', reg.scope))
      .catch((err) => console.warn('[SW] Failed:', err));
  });
}

// React 18 Standard Root Rendering
const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <SocietyMaps />
    </React.StrictMode>
  );
}
