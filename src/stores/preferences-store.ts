/**
 * User Preferences Store
 * 
 * Manages user preferences for branching behavior, UI settings,
 * theme preferences, and other customizable options. Persists to localStorage.
 * 
 * @version 2.1.0
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import type { 
  BranchingPreferences, 
} from '@/types';
import { STORAGE_KEYS, VersionedStorage, CURRENT_SCHEMA_VERSION } from '@/lib/storage';

// =============================================================================
// TYPES
// =============================================================================

export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserPreferences {
  /** Branching-related preferences */
  branching: BranchingPreferences;
  /** UI preferences */
  ui: {
    /** Confirm before deleting */
    confirmOnDelete: boolean;
    /** Chat panel width (persisted, min: 400, max: 800) */
    chatPanelWidth: number;
    /** Whether the left sidebar is open/expanded */
    sidebarOpen: boolean;
    /** Theme mode: light, dark, or system */
    theme: ThemeMode;
    /** Whether the canvas tip has been shown */
    hasSeenCanvasTip: boolean;
  };
}

interface PreferencesState {
  preferences: UserPreferences;
  isLoaded: boolean;
}

interface PreferencesActions {
  /** Load preferences from storage */
  loadPreferences: () => void;
  /** Save preferences to storage */
  savePreferences: () => void;
  /** Update branching preferences */
  setBranchingPreferences: (prefs: Partial<BranchingPreferences>) => void;
  /** Update UI preferences */
  setUIPreferences: (prefs: Partial<UserPreferences['ui']>) => void;
  /** Set theme mode and apply to document */
  setTheme: (theme: ThemeMode) => void;
  /** Reset to defaults */
  resetToDefaults: () => void;

}

// =============================================================================
// DEFAULTS
// =============================================================================

const DEFAULT_BRANCHING_PREFERENCES: BranchingPreferences = {
  defaultInheritanceMode: 'full',
};

const DEFAULT_UI_PREFERENCES: UserPreferences['ui'] = {
  confirmOnDelete: true,
  chatPanelWidth: 480, // Default 30% of 1600px viewport
  sidebarOpen: false, // Left sidebar hidden by default — users can open it
  theme: 'system', // Follow system preference by default
  hasSeenCanvasTip: false,
};

const DEFAULT_PREFERENCES: UserPreferences = {
  branching: DEFAULT_BRANCHING_PREFERENCES,
  ui: DEFAULT_UI_PREFERENCES,
};

// =============================================================================
// STORAGE
// =============================================================================

const preferencesStorage = new VersionedStorage<UserPreferences>({
  key: STORAGE_KEYS.PREFERENCES,
  version: CURRENT_SCHEMA_VERSION,
  defaultData: DEFAULT_PREFERENCES,
  debug: process.env.NODE_ENV === 'development',
});

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Apply theme to document root
 */
function applyTheme(theme: ThemeMode): void {
  if (typeof window === 'undefined') return;
  
  const root = document.documentElement;
  
  if (theme === 'system') {
    // Remove data-theme to let CSS media query handle it
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

/**
 * Get resolved theme (accounts for system preference)
 */
function getResolvedTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Merge loaded preferences with defaults to ensure all fields exist
 */
function mergeWithDefaults(loadedPrefs: Partial<UserPreferences>): UserPreferences {
  return {
    branching: {
      ...DEFAULT_BRANCHING_PREFERENCES,
      ...loadedPrefs.branching,
    },
    ui: {
      ...DEFAULT_UI_PREFERENCES,
      ...loadedPrefs.ui,
    },
  };
}

/**
 * Load preferences from storage (used for initialization)
 */
function loadInitialPreferences(): { preferences: UserPreferences; isLoaded: boolean } {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    return { preferences: DEFAULT_PREFERENCES, isLoaded: false };
  }
  
  const result = preferencesStorage.load();
  if (result.success) {
    const prefs = mergeWithDefaults(result.data);
    // Apply theme on initial load
    applyTheme(prefs.ui.theme);
    return { preferences: prefs, isLoaded: true };
  }
  // Apply default theme
  applyTheme(DEFAULT_UI_PREFERENCES.theme);
  return { preferences: DEFAULT_PREFERENCES, isLoaded: true };
}

// Auto-load preferences on store creation
const initialState = loadInitialPreferences();

// =============================================================================
// STORE
// =============================================================================

export const usePreferencesStore = create<PreferencesState & PreferencesActions>()(
  subscribeWithSelector((set, get) => ({
    // Initial state (auto-loaded)
    preferences: initialState.preferences,
    isLoaded: initialState.isLoaded,

    // =========================================================================
    // Actions
    // =========================================================================

    loadPreferences: () => {
      // Skip if already loaded (prevents redundant calls)
      if (get().isLoaded) return;
      
      const result = preferencesStorage.load();
      
      if (result.success) {
        set({ preferences: mergeWithDefaults(result.data), isLoaded: true });
      } else {
        set({ preferences: DEFAULT_PREFERENCES, isLoaded: true });
      }
    },

    savePreferences: () => {
      const { preferences } = get();
      preferencesStorage.save(preferences);
    },

    setBranchingPreferences: (prefs: Partial<BranchingPreferences>) => {
      set((state) => ({
        preferences: {
          ...state.preferences,
          branching: {
            ...state.preferences.branching,
            ...prefs,
          },
        },
      }));
      get().savePreferences();
    },

    setUIPreferences: (prefs: Partial<UserPreferences['ui']>) => {
      set((state) => ({
        preferences: {
          ...state.preferences,
          ui: {
            ...state.preferences.ui,
            ...prefs,
          },
        },
      }));
      get().savePreferences();
    },

    setTheme: (theme: ThemeMode) => {
      applyTheme(theme);
      set((state) => ({
        preferences: {
          ...state.preferences,
          ui: {
            ...state.preferences.ui,
            theme,
          },
        },
      }));
      get().savePreferences();
    },

    resetToDefaults: () => {
      set({ preferences: DEFAULT_PREFERENCES });
      applyTheme(DEFAULT_UI_PREFERENCES.theme);
      get().savePreferences();
    },


  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectUIPreferences = (state: PreferencesState) => 
  state.preferences.ui;

export const selectTheme = (state: PreferencesState) => 
  state.preferences.ui.theme;

// Export helper for resolved theme
export { getResolvedTheme };