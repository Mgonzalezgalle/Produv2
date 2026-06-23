import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => {
        if (!('caches' in window)) return null
        return caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      })
      .catch((err) => {
        console.error('No se pudo desregistrar el service worker', err)
      })
  })
}
