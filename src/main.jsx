import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { NetworkProvider } from './contexts/NetworkContext.jsx'
import { HandleProvider } from './contexts/HandleContext.jsx'
import { PeerProvider } from './contexts/PeerContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NetworkProvider>
      <HandleProvider>
        <PeerProvider>
          <App />
        </PeerProvider>
      </HandleProvider>
    </NetworkProvider>
  </StrictMode>,
)
