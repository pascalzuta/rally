import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { RallyDataProvider } from './context/RallyDataProvider'

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
