import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './index.css'
import App from './App.jsx'
import AuthProvider from './contexto/AuthProvider.jsx'
import PreferenciasProvider from './contexto/PreferenciasProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <PreferenciasProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </PreferenciasProvider>
    </BrowserRouter>
  </StrictMode>,
)
