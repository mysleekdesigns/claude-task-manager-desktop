import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/hooks/useAuth';

type Theme = 'dark' | 'light' | 'system';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => Promise<void>;
  resolvedTheme: 'dark' | 'light';
  systemTheme: 'dark' | 'light';
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: async () => { /* noop */ },
  resolvedTheme: 'dark',
  systemTheme: 'dark',
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Hook to subscribe to system theme changes using useSyncExternalStore
 */
function useSystemTheme(): 'dark' | 'light' {
  const subscribe = useCallback((callback: () => void) => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', callback);
    return () => {
      mediaQuery.removeEventListener('change', callback);
    };
  }, []);

  const getSnapshot = useCallback(() => getSystemTheme(), []);
  const getServerSnapshot = useCallback(() => 'dark' as const, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'claude-tasks-theme',
  ...props
}: ThemeProviderProps) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    return (localStorage.getItem(storageKey) as Theme) ?? defaultTheme;
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const systemTheme = useSystemTheme();

  // Derive resolvedTheme from theme and systemTheme (no separate state needed)
  const resolvedTheme = useMemo<'dark' | 'light'>(() => {
    if (theme === 'system') {
      return systemTheme;
    }
    return theme;
  }, [theme, systemTheme]);

  // Load theme from database on mount (if user is logged in)
  useEffect(() => {
    async function loadThemeFromDatabase() {
      if (!user?.id) {
        setIsInitialized(true);
        return;
      }

      try {
        const settings = await window.electron.invoke<{
          theme: string;
        }>('settings:get', user.id);

        if (settings && settings.theme) {
          const dbTheme = settings.theme as Theme;
          setThemeState(dbTheme);
          localStorage.setItem(storageKey, dbTheme);
        }
      } catch (error) {
        console.error('Failed to load theme from database:', error);
        // Fallback to localStorage theme is already set in initial state
      } finally {
        setIsInitialized(true);
      }
    }

    if (!isInitialized) {
      void loadThemeFromDatabase();
    }
  }, [user?.id, storageKey, isInitialized]);

  // Apply theme class to document root
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  // Update theme in database and localStorage
  const setTheme = useCallback(
    async (newTheme: Theme) => {
      // Update localStorage immediately for instant feedback
      localStorage.setItem(storageKey, newTheme);
      setThemeState(newTheme);

      // Sync with database if user is logged in
      if (user?.id) {
        try {
          await window.electron.invoke('settings:update', user.id, {
            theme: newTheme,
          });
        } catch (error) {
          console.error('Failed to save theme to database:', error);
          // Theme is still applied from localStorage, just not persisted to DB
        }
      }
    },
    [user?.id, storageKey]
  );

  const value = {
    theme,
    setTheme,
    resolvedTheme,
    systemTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
