import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LearningProvider } from './lib/learningStore.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LearningProvider>
      <App />
    </LearningProvider>
  </StrictMode>,
)
