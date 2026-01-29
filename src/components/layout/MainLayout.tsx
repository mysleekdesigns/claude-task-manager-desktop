import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ProjectSelector } from './ProjectSelector';
import { ConflictResolutionModal } from '@/components/collaboration';
import { TerminalsPage } from '@/routes/terminals';

/**
 * MainLayout component that wraps the application with a sidebar
 * and renders child routes in the main content area.
 *
 * IMPORTANT: The TerminalsPage is always mounted (after first visit) to prevent
 * xterm.js terminals from being destroyed when navigating away. CSS visibility
 * property is used to show/hide the terminals container based on the current route.
 * Using visibility:hidden instead of display:none preserves terminal dimensions,
 * preventing xterm.js buffer reflow/corruption that occurs when container dimensions
 * become 0 (which happens with display:none).
 */
export function MainLayout() {
  const location = useLocation();
  const isOnTerminals = location.pathname === '/terminals' || location.pathname === '/terminals/';

  // Lazy mount: Only render TerminalsPage after user first visits the terminals route
  // This avoids unnecessary resource usage (terminal processes, IPC connections) until needed
  const [hasVisitedTerminals, setHasVisitedTerminals] = useState(false);

  useEffect(() => {
    if (isOnTerminals && !hasVisitedTerminals) {
      setHasVisitedTerminals(true);
    }
  }, [isOnTerminals, hasVisitedTerminals]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Project Selector */}
        <header className="h-14 border-b border-border bg-background flex items-center justify-end px-4 titlebar-drag-region">
          <ProjectSelector />
        </header>

        {/* Main Content - pt-6 accounts for macOS titlebar spacing */}
        <main className="flex-1 overflow-hidden bg-background pt-6 relative">
          {/* Regular routed content - hidden when on terminals route */}
          {/* Uses visibility:hidden to allow terminals layer to show through */}
          <div
            className="absolute inset-0 overflow-y-auto"
            style={{
              visibility: isOnTerminals ? 'hidden' : 'visible',
              pointerEvents: isOnTerminals ? 'none' : 'auto'
            }}
          >
            <Outlet />
          </div>

          {/* Terminals - always mounted after first visit, hidden via CSS when not active */}
          {/* Uses visibility:hidden instead of display:none to preserve terminal dimensions */}
          {/* This prevents xterm.js buffer reflow/corruption that occurs when dimensions become 0 */}
          {hasVisitedTerminals && (
            <div
              className="absolute inset-0"
              style={{
                visibility: isOnTerminals ? 'visible' : 'hidden',
                pointerEvents: isOnTerminals ? 'auto' : 'none'
              }}
            >
              <TerminalsPage isVisible={isOnTerminals} />
            </div>
          )}
        </main>
      </div>

      {/* Global Conflict Resolution Modal */}
      <ConflictResolutionModal />
    </div>
  );
}
