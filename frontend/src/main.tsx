import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LearningProvider } from './lib/learningStore.tsx'
import { DoneProvider } from './lib/doneStore.tsx'
import { CustomizeProvider } from './lib/customizeStore.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CustomizeProvider>
      <LearningProvider>
        <DoneProvider>
          <App />
        </DoneProvider>
      </LearningProvider>
    </CustomizeProvider>
  </StrictMode>,
)
