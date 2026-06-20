import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LearningProvider } from './lib/learningStore.tsx'
import { DoneProvider } from './lib/doneStore.tsx'
import { CommPrefProvider } from './lib/commPrefStore.tsx'
import { RmProfileProvider } from './lib/rmProfileStore.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RmProfileProvider>
      <LearningProvider>
        <DoneProvider>
          <CommPrefProvider>
            <App />
          </CommPrefProvider>
        </DoneProvider>
      </LearningProvider>
    </RmProfileProvider>
  </StrictMode>,
)






























