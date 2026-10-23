import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { i18nReady } from './i18n.js'
import App from './App.jsx'

// Wait for the visitor's language so the first paint is already translated.
await i18nReady

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
