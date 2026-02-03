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
// STORE
// =============================================================================

export const usePreferencesStore = create<PreferencesState & PreferencesActions>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    preferences: DEFAULT_PREFERENCES,
    isLoaded: false,

    // =========================================================================
    // Actions
    // =========================================================================

    loadPreferences: () => {
      const result = preferencesStorage.load();
      
      if (result.success) {
        // Merge with defaults to ensure all fields exist
        const loadedPrefs = result.data;
        const merged: UserPreferences = {
          branching: {
            ...DEFAULT_BRANCHING_PREFERENCES,
            ...loadedPrefs.branching,
          },
          ui: {
            ...DEFAULT_UI_PREFERENCES,
            ...loadedPrefs.ui,
          },
        };
        
        set({ preferences: merged, isLoaded: true });
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
