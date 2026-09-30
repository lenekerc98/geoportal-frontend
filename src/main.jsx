import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// Registrar Service Worker para PWA Offline
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
