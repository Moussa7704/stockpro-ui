import { RouterProvider } from 'react-router-dom'
import { router } from './routes/router'

// La session (Redux) et le cache des données (TanStack Query) sont fournis dans main.tsx
function App() {
  return <RouterProvider router={router} />
}

export default App
