/**
 * User Preferences Store
 * 
 * Manages user preferences for branching behavior, UI settings,
 * and other customizable options. Persists to localStorage.
 * 
 * @version 2.0.0
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import type { 
  BranchingPreferences, 
  InheritanceMode, 
  TruncationStrategy 
} from '@/types';
import { STORAGE_KEYS, VersionedStorage, CURRENT_SCHEMA_VERSION } from '@/lib/storage';

// =============================================================================
// TYPES
// =============================================================================

export interface UserPreferences {
  /** Branching-related preferences */
  branching: BranchingPreferences;
  /** UI preferences */
  ui: {
    /** Show canvas tree sidebar */
    showCanvasTree: boolean;
    /** Show inherited context panel */
    showInheritedContext: boolean;
    /** Confirm before deleting */
    confirmOnDelete: boolean;
    /** Chat panel width (persisted, min: 400, max: 800) */
    chatPanelWidth: number;
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
  /** Reset to defaults */
  resetToDefaults: () => void;
  /** Get current inheritance mode (considering defaults) */
  getDefaultInheritanceMode: () => InheritanceMode;
  /** Get whether to show branch dialog */
  shouldShowBranchDialog: () => boolean;
}

// =============================================================================
// DEFAULTS
// =============================================================================

const DEFAULT_TRUNCATION_STRATEGY: TruncationStrategy = {
  type: 'boundary',
  maxMessages: 10,
};

const DEFAULT_BRANCHING_PREFERENCES: BranchingPreferences = {
  defaultInheritanceMode: 'full',
  alwaysAskOnBranch: true,
  defaultTruncationStrategy: DEFAULT_TRUNCATION_STRATEGY,
};

const DEFAULT_UI_PREFERENCES: UserPreferences['ui'] = {
  showCanvasTree: true,
  showInheritedContext: true,
  confirmOnDelete: true,
  chatPanelWidth: 480, // Default 30% of 1600px viewport
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
    return { preferences: mergeWithDefaults(result.data), isLoaded: true };
  }
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

    resetToDefaults: () => {
      set({ preferences: DEFAULT_PREFERENCES });
      get().savePreferences();
    },

    getDefaultInheritanceMode: () => {
      return get().preferences.branching.defaultInheritanceMode;
    },

    shouldShowBranchDialog: () => {
      return get().preferences.branching.alwaysAskOnBranch;
    },
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectBranchingPreferences = (state: PreferencesState) => 
  state.preferences.branching;

export const selectUIPreferences = (state: PreferencesState) => 
  state.preferences.ui;

export const selectDefaultInheritanceMode = (state: PreferencesState) => 
  state.preferences.branching.defaultInheritanceMode;

export const selectAlwaysAskOnBranch = (state: PreferencesState) => 
  state.preferences.branching.alwaysAskOnBranch;
