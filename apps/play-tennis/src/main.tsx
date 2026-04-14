import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { RallyDataProvider } from './context/RallyDataProvider'
import { isNative } from './native/platform'

if (isNative) {
  document.documentElement.classList.add('native-app')
  // Ensure safe-area-inset env vars activate in the native WKWebView
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
