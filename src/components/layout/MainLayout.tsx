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
          {/* z-index ensures proper layering: higher when active, lower when terminals are shown */}
          <div
            className="absolute inset-0 overflow-y-auto"
            style={{
              visibility: isOnTerminals ? 'hidden' : 'visible',
              pointerEvents: isOnTerminals ? 'none' : 'auto',
              zIndex: isOnTerminals ? 0 : 10
            }}
          >
            <Outlet />
          </div>

          {/* Terminals - always mounted after first visit, hidden via CSS when not active */}
          {/* Uses visibility:hidden + off-screen positioning to truly hide while preserving dimensions */}
          {/* This is the xterm.js recommended pattern: move off-screen (left: -9999px) keeps the */}
          {/* container sized correctly for FitAddon while making it truly invisible */}
          {/* z-index ensures proper layering: higher when active, lower when other routes are shown */}
          {hasVisitedTerminals && (
            <div
              className={isOnTerminals ? "absolute inset-0" : ""}
              style={{
                visibility: isOnTerminals ? 'visible' : 'hidden',
                opacity: isOnTerminals ? 1 : 0,
                pointerEvents: isOnTerminals ? 'auto' : 'none',
                zIndex: isOnTerminals ? 10 : 0,
                // Move completely off-screen when hidden - xterm.js recommended pattern
                // This keeps dimensions intact for FitAddon while truly hiding the terminals
                ...(isOnTerminals ? {} : {
                  position: 'fixed' as const,
                  left: '-9999px',
                  top: 0,
                  width: '100vw',
                  height: '100vh'
                })
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
