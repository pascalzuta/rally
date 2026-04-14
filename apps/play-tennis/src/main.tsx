import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { RallyDataProvider } from './context/RallyDataProvider'
// CAPACITOR_BUILD is set at build time via env var. This avoids runtime detection
// issues with Capacitor version mismatches between npm (8.x) and Swift PM (7.x).
if (import.meta.env.VITE_CAPACITOR_BUILD) {
  document.documentElement.classList.add('native-app')
  const vp = document.querySelector('meta[name="viewport"]')
  if (vp && !vp.getAttribute('content')?.includes('viewport-fit')) {
    vp.setAttribute('content', vp.getAttribute('content') + ', viewport-fit=cover')
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RallyDataProvider>
          <App />
        </RallyDataProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
