import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Match Vite base so routing works on GitHub Pages (e.g. /Portfolio-website/) and locally
const base = import.meta.env.BASE_URL ?? '/'
const basename = base !== '/' && base !== './' ? base.replace(/\/$/, '') : undefined

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
