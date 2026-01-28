import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ProjectSelector } from './ProjectSelector';
import { ConflictResolutionModal } from '@/components/collaboration';

/**
 * MainLayout component that wraps the application with a sidebar
 * and renders child routes in the main content area.
 */
export function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Project Selector */}
        <header className="h-14 border-b border-border bg-background flex items-center justify-end px-4 titlebar-drag-region">
          <ProjectSelector />
        </header>

        {/* Main Content - pt-6 accounts for macOS titlebar spacing */}
        <main className="flex-1 overflow-y-auto bg-background pt-6">
          <Outlet />
        </main>
      </div>

      {/* Global Conflict Resolution Modal */}
      <ConflictResolutionModal />
    </div>
  );
}
