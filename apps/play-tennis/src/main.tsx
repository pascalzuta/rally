import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { RallyDataProvider } from './context/RallyDataProvider'
import { initNativeListeners } from './native'
import { consumeUrlOverrides, isEnabled as isFlagEnabled } from './featureFlags'

// Capture any feature-flag overrides in the URL (e.g. ?newhome=1) into
// localStorage immediately, so the flag survives auth-redirect navigations
// that strip the query string before the relevant route mounts.
consumeUrlOverrides()

// Toggle the reskin class on <html> based on the newHome flag. Doing it
// here means the whole app — including existing screens — picks up the
// reskin token re-map before the first paint, so the user sees a
// consistent warm canvas + court-green accent everywhere the flag is on.
if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('rally-reskin', isFlagEnabled('newHome'))
}

// Register appUrlOpen listener BEFORE React renders, so OAuth Universal Link
// callbacks are caught even when the user is not yet authenticated.
initNativeListeners()

// Native-only init. Use Capacitor's runtime detection — previous build-time env
// var (VITE_CAPACITOR_BUILD) gets tree-shaken out by Vite when the flag isn't
// inlined by define:, so the whole block silently disappeared from the iOS bundle.
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native-app')
  const vp = document.querySelector('meta[name="viewport"]')
  if (vp && !vp.getAttribute('content')?.includes('viewport-fit')) {
    vp.setAttribute('content', vp.getAttribute('content') + ', viewport-fit=cover')
  }

  // Emergency splash hide: if React/auth hangs for any reason, force the splash
  // down after 4s so the user is never trapped on the blue-logo screen. Safe
  // because normal flow hides it ~instantly via initNativeApp once auth resolves.
  setTimeout(async () => {
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen')
      await SplashScreen.hide({ fadeOutDuration: 200 })
    } catch {
      // plugin unavailable — fine
    }
  }, 4000)
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
