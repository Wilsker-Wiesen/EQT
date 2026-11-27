import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Platzhalter: Die Oberfläche folgt nach Schema, Prüfskript und Logik.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main style={{ fontFamily: 'system-ui', padding: 16 }}>
      <h1>EQT</h1>
      <p>Hörverstehen Französisch – im Aufbau.</p>
    </main>
  </StrictMode>,
)
