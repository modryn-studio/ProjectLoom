/**
 * API Key Manager
 * 
 * Hybrid approach for API key management:
 * - Environment variables for production (priority)
 * - localStorage for development (fallback)
 * 
 * @version 2.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

export type ProviderType = 'anthropic' | 'openai' | 'perplexity';
export type StorageType = 'localStorage' | 'sessionStorage';

export interface APIKeyInfo {
  /** The API key (if available) */
  key: string | null;
  /** Source of the key */
  source: 'env' | 'localStorage' | 'sessionStorage' | 'none';
  /** Whether this is a dev-mode key (browser storage) */
  isDevMode: boolean;
}

export interface APIKeyStatus {
  hasAnyKey: boolean;
  providers: Record<ProviderType, APIKeyInfo>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = 'projectloom:api-keys';
const STORAGE_PREF_KEY = 'projectloom:storage-preference';

const PROVIDER_DISPLAY_NAMES: Record<ProviderType, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  perplexity: 'Perplexity (All Models)',
};

// =============================================================================
// API KEY MANAGER CLASS
// =============================================================================

class APIKeyManager {
  /**
   * Get the storage object based on preference
   */
  private getStorage(): Storage | null {
    if (typeof window === 'undefined') return null;

    const preference = this.getStoragePreference();
    return preference === 'sessionStorage' ? window.sessionStorage : window.localStorage;
  }

  /**
   * Check if storage is available
   */
  private isStorageAvailable(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const storage = this.getStorage();
      if (!storage) return false;

      const testKey = '__storage_test__';
      storage.setItem(testKey, testKey);
      storage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage preference (defaults to localStorage for backwards compatibility)
   */
  getStoragePreference(): StorageType {
    if (typeof window === 'undefined') return 'localStorage';

    try {
      // Storage preference itself is always in localStorage to persist across sessions
      const pref = window.localStorage.getItem(STORAGE_PREF_KEY);
      return pref === 'sessionStorage' ? 'sessionStorage' : 'localStorage';
    } catch {
      return 'localStorage';
    }
  }

  /**
   * Set storage preference
   */
  setStoragePreference(type: StorageType): boolean {
    if (typeof window === 'undefined') return false;

    try {
      // Storage preference is always stored in localStorage
      window.localStorage.setItem(STORAGE_PREF_KEY, type);

      // If switching storage types, migrate existing keys
      const oldStorage = type === 'sessionStorage' ? window.localStorage : window.sessionStorage;
      const newStorage = type === 'sessionStorage' ? window.sessionStorage : window.localStorage;

      const oldData = oldStorage.getItem(STORAGE_KEY);
      if (oldData) {
        newStorage.setItem(STORAGE_KEY, oldData);
        oldStorage.removeItem(STORAGE_KEY);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get stored keys from browser storage
   */
  private getStoredKeys(): Record<string, string> {
    if (!this.isStorageAvailable()) return {};

    try {
      const storage = this.getStorage();
      if (!storage) return {};

      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return {};

      const parsed = JSON.parse(raw);
      // Deobfuscate keys
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') {
          result[key] = this.deobfuscate(value);
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  /**
   * Basic obfuscation (NOT real encryption, just prevents casual viewing)
   */
  private obfuscate(key: string): string {
    return btoa(key);
  }

  /**
   * Deobfuscate stored key
   */
  private deobfuscate(encoded: string): string {
    try {
      return atob(encoded);
    } catch {
      return encoded;
    }
  }

  /**
   * Get API key for a provider
   */
  getKey(provider: ProviderType): string | null {
    const storedKeys = this.getStoredKeys();
    return storedKeys[provider] || null;
  }

  /**
   * Get detailed key info for a provider
   */
  getKeyInfo(provider: ProviderType): APIKeyInfo {
    const storedKeys = this.getStoredKeys();
    const localKey = storedKeys[provider];
    if (localKey) {
      const storageType = this.getStoragePreference();
      return {
        key: localKey,
        source: storageType,
        isDevMode: true,
      };
    }

    return {
      key: null,
      source: 'none',
      isDevMode: false,
    };
  }

  /**
   * Save API key to browser storage
   */
  saveKey(provider: ProviderType, key: string): boolean {
    if (!this.isStorageAvailable()) return false;

    try {
      const storage = this.getStorage();
      if (!storage) return false;

      const keys = this.getStoredKeys();
      keys[provider] = key;

      // Obfuscate before storing
      const toStore: Record<string, string> = {};
      for (const [k, v] of Object.entries(keys)) {
        toStore[k] = this.obfuscate(v);
      }

      storage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove API key from browser storage
   */
  removeKey(provider: ProviderType): boolean {
    if (!this.isStorageAvailable()) return false;

    try {
      const storage = this.getStorage();
      if (!storage) return false;

      const keys = this.getStoredKeys();
      delete keys[provider];

      // Obfuscate remaining before storing
      const toStore: Record<string, string> = {};
      for (const [k, v] of Object.entries(keys)) {
        toStore[k] = this.obfuscate(v);
      }

      storage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all stored keys
   */
  clearKeys(): boolean {
    if (!this.isStorageAvailable()) return false;

    try {
      const storage = this.getStorage();
      if (!storage) return false;

      storage.removeItem(STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if user has the Perplexity API key configured.
   * All models route through Perplexity Agent API — only one key needed.
   */
  hasAnyKey(): boolean {
    return this.getKey('perplexity') !== null;
  }

  /**
   * Get status of all providers
   */
  getStatus(): APIKeyStatus {
    return {
      hasAnyKey: this.hasAnyKey(),
      providers: {
        anthropic: this.getKeyInfo('anthropic'),
        openai: this.getKeyInfo('openai'),
        perplexity: this.getKeyInfo('perplexity'),
      },
    };
  }

  /**
   * Check if any keys are stored in localStorage (dev mode warning)
   */
  hasDevModeKeys(): boolean {
    const status = this.getStatus();
    return Object.values(status.providers).some(info => info.isDevMode);
  }

  /**
   * Get provider display name
   */
  getProviderDisplayName(provider: ProviderType): string {
    return PROVIDER_DISPLAY_NAMES[provider] || provider;
  }

  /**
   * Mask API key for display (show first 8 and last 4 chars)
   */
  maskKey(key: string): string {
    if (key.length <= 12) return '••••••••';
    return `${key.slice(0, 8)}••••••••${key.slice(-4)}`;
  }

  /**
   * Validate API key format (basic validation)
   */
  validateKeyFormat(provider: ProviderType, key: string): { valid: boolean; error?: string } {
    if (!key || key.trim().length === 0) {
      return { valid: false, error: 'API key cannot be empty' };
    }

    switch (provider) {
      case 'anthropic':
        if (!key.startsWith('sk-ant-')) {
          return { valid: false, error: 'Anthropic API keys should start with "sk-ant-"' };
        }
        break;
      case 'openai':
        if (!key.startsWith('sk-')) {
          return { valid: false, error: 'OpenAI API keys should start with "sk-"' };
        }
        break;
      case 'perplexity':
        if (!key.startsWith('pplx-')) {
          return { valid: false, error: 'Perplexity API keys should start with "pplx-"' };
        }
        break;
    }

    return { valid: true };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const apiKeyManager = new APIKeyManager();

// =============================================================================
// REACT HOOK (for components)
// =============================================================================

import { useState, useCallback } from 'react';

export function useAPIKeyStatus() {
  const [status, setStatus] = useState<APIKeyStatus>(() => apiKeyManager.getStatus());

  const refreshStatus = useCallback(() => {
    setStatus(apiKeyManager.getStatus());
  }, []);

  const saveKey = useCallback((provider: ProviderType, key: string): boolean => {
    const success = apiKeyManager.saveKey(provider, key);
    if (success) refreshStatus();
    return success;
  }, [refreshStatus]);

  const removeKey = useCallback((provider: ProviderType): boolean => {
    const success = apiKeyManager.removeKey(provider);
    if (success) refreshStatus();
    return success;
  }, [refreshStatus]);

  return {
    status,
    refreshStatus,
    saveKey,
    removeKey,
    hasDevModeKeys: status.providers.anthropic.isDevMode
      || status.providers.openai.isDevMode
      || status.providers.google.isDevMode
      || status.providers.perplexity.isDevMode,
  };
}
