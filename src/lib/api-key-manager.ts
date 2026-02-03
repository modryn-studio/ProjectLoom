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

export type ProviderType = 'anthropic' | 'openai';

export interface APIKeyInfo {
  /** The API key (if available) */
  key: string | null;
  /** Source of the key */
  source: 'env' | 'localStorage' | 'none';
  /** Whether this is a dev-mode key (localStorage) */
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

const ENV_VAR_MAP: Record<ProviderType, string> = {
  anthropic: 'NEXT_PUBLIC_ANTHROPIC_API_KEY',
  openai: 'NEXT_PUBLIC_OPENAI_API_KEY',
};

const PROVIDER_DISPLAY_NAMES: Record<ProviderType, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
};

// =============================================================================
// API KEY MANAGER CLASS
// =============================================================================

class APIKeyManager {
  /**
   * Check if localStorage is available
   */
  private isStorageAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get environment variable key
   */
  private getEnvKey(provider: ProviderType): string | null {
    const envVar = ENV_VAR_MAP[provider];
    const value = process.env[envVar];
    return value && value.length > 0 ? value : null;
  }

  /**
   * Get stored keys from localStorage
   */
  private getStoredKeys(): Record<string, string> {
    if (!this.isStorageAvailable()) return {};
    
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
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
   * Priority: Environment variables > localStorage
   */
  getKey(provider: ProviderType): string | null {
    // 1. Check environment variables (production)
    const envKey = this.getEnvKey(provider);
    if (envKey) return envKey;
    
    // 2. Fall back to localStorage (development)
    const storedKeys = this.getStoredKeys();
    return storedKeys[provider] || null;
  }

  /**
   * Get detailed key info for a provider
   */
  getKeyInfo(provider: ProviderType): APIKeyInfo {
    const envKey = this.getEnvKey(provider);
    if (envKey) {
      return {
        key: envKey,
        source: 'env',
        isDevMode: false,
      };
    }
    
    const storedKeys = this.getStoredKeys();
    const localKey = storedKeys[provider];
    if (localKey) {
      return {
        key: localKey,
        source: 'localStorage',
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
   * Save API key to localStorage
   */
  saveKey(provider: ProviderType, key: string): boolean {
    if (!this.isStorageAvailable()) return false;
    
    try {
      const keys = this.getStoredKeys();
      keys[provider] = key;
      
      // Obfuscate before storing
      const toStore: Record<string, string> = {};
      for (const [k, v] of Object.entries(keys)) {
        toStore[k] = this.obfuscate(v);
      }
      
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove API key from localStorage
   */
  removeKey(provider: ProviderType): boolean {
    if (!this.isStorageAvailable()) return false;
    
    try {
      const keys = this.getStoredKeys();
      delete keys[provider];
      
      // Obfuscate remaining before storing
      const toStore: Record<string, string> = {};
      for (const [k, v] of Object.entries(keys)) {
        toStore[k] = this.obfuscate(v);
      }
      
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
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
      window.localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if user has any API keys configured
   */
  hasAnyKey(): boolean {
    return this.getKey('anthropic') !== null || this.getKey('openai') !== null;
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

import { useState, useEffect, useCallback } from 'react';

export function useAPIKeyStatus() {
  const [status, setStatus] = useState<APIKeyStatus>(() => apiKeyManager.getStatus());

  useEffect(() => {
    // Refresh status on mount (in case env vars changed)
    setStatus(apiKeyManager.getStatus());
  }, []);

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
    hasDevModeKeys: status.providers.anthropic.isDevMode || status.providers.openai.isDevMode,
  };
}
