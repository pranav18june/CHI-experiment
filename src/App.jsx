import React from 'react'
import { StudyProvider } from './context/StudyContext.jsx'
import { StudyRouter } from './routes/StudyRouter.jsx'

/**
 * App — the root application shell.
 *
 * Provides the global study state to the entire component tree via
 * StudyProvider, then delegates all routing to StudyRouter.
 *
 * Note: BrowserRouter is provided one level up in main.jsx so that
 * StudyProvider can use useNavigate() internally.
 */
function App() {
  return (
    <StudyProvider>
      <StudyRouter />
    </StudyProvider>
  )
}

export default App
