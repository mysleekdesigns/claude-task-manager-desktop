/**
 * App Component
 *
 * Root application component with React Router v7.
 * Manages routing and authentication state.
 */

import { createHashRouter, RouterProvider } from 'react-router-dom';
import { routes } from '@/routes/routes';

// Create router instance with our route configuration
// Using HashRouter for Electron compatibility (file:// protocol doesn't support browser history)
const router = createHashRouter(routes);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
