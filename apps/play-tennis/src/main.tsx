import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { RallyDataProvider } from './context/RallyDataProvider'
import { initNativeListeners } from './native'

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

// Dev-only design preview: bypasses Supabase / providers entirely so design
// fidelity work can iterate without a live login. Enabled only in local dev
// and on the reskin-staging Vercel preview — never in production / staging.
const isDevScreensRoute = window.location.pathname.startsWith('/dev/screens')
const devScreensAllowed =
  import.meta.env.DEV ||
  (typeof window !== 'undefined' && /reskin-staging/.test(window.location.hostname))

if (isDevScreensRoute && devScreensAllowed) {
  // Lazy import so the bundle for this entry never reaches normal users.
  import('./baseline.css').then(() => import('./styles.css')).then(() => {
    import('./dev/MockScreens').then(({ default: MockScreens }) => {
      ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
          <BrowserRouter>
            <MockScreens />
          </BrowserRouter>
        </React.StrictMode>
      )
    })
  })
} else {
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
}
