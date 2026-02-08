/**
 * Versioned Storage Layer
 * 
 * Provides localStorage persistence with schema versioning,
 * migration handlers, and error recovery.
 * 
 * @version 4.0.0 - Card-level branching architecture
 */

// =============================================================================
// TYPES
// =============================================================================

export interface StorageSchema<T = unknown> {
  /** Schema version for migrations */
  version: number;
  /** The actual data */
  data: T;
  /** Timestamp of last save */
  savedAt: string;
  /** Checksum for data integrity (optional) */
  checksum?: string;
}

export interface Migration<TFrom = unknown, TTo = unknown> {
  fromVersion: number;
  toVersion: number;
  migrate: (data: TFrom) => TTo;
}

export interface StorageOptions<T> {
  /** Storage key in localStorage */
  key: string;
  /** Current schema version */
  version: number;
  /** Default data if nothing is stored */
  defaultData: T;
  /** Array of migrations to apply */
  migrations?: Migration[];
  /** Enable console logging */
  debug?: boolean;
}

export interface StorageResult<T> {
  success: boolean;
  data: T;
  migrated: boolean;
  fromVersion?: number;
  error?: Error;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Current schema version
 * Version 2: Added title field to Conversation type
 * Version 3: Added multi-canvas support with branching
 * Version 4: Card-level branching architecture (fresh start)
 *            - Workspaces are flat (no hierarchy)
 *            - Cards have parentCardIds for branching
 *            - Support for merge nodes with multiple parents
 */
export const CURRENT_SCHEMA_VERSION = 4;

export const STORAGE_KEYS = {
  /** @deprecated Use WORKSPACES */
  CANVAS: 'projectloom:canvas',
  /** @deprecated Use WORKSPACES */
  CANVAS_DATA: 'projectloom:canvas-data',
  /** @deprecated Use WORKSPACES */
  CANVASES: 'projectloom:canvases',
  /** v4 - Flat workspaces with card-level branching */
  WORKSPACES: 'projectloom:workspaces',
  /** User preferences */
  PREFERENCES: 'projectloom:preferences',
  /** API keys */
  API_KEYS: 'projectloom:api-keys',
  /** v4 migration notice dismissed */
  V4_NOTICE_DISMISSED: 'projectloom:v4-notice-dismissed',
} as const;

/**
 * Clear all legacy storage keys for v4 fresh start
 */
export function clearLegacyStorage(): void {
  if (typeof window === 'undefined') return;
  
  const legacyKeys = [
    STORAGE_KEYS.CANVAS,
    STORAGE_KEYS.CANVAS_DATA,
    STORAGE_KEYS.CANVASES,
  ];
  
  legacyKeys.forEach(key => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore errors during cleanup
    }
  });
  
  // Note: Using raw console.log here since logger may not be initialized yet
  if (process.env.NODE_ENV === 'development') {
    console.log('🔄 ProjectLoom v4: Cleared legacy storage');
  }
}

/**
 * Check if v4 migration notice was dismissed
 */
export function isV4NoticeDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(STORAGE_KEYS.V4_NOTICE_DISMISSED) === 'true';
}

/**
 * Dismiss v4 migration notice
 */
export function dismissV4Notice(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS.V4_NOTICE_DISMISSED, 'true');
}

// =============================================================================
// STORAGE CLASS
// =============================================================================

export class VersionedStorage<T> {
  private key: string;
  private version: number;
  private defaultData: T;
  private migrations: Migration[];
  private debug: boolean;

  constructor(options: StorageOptions<T>) {
    this.key = options.key;
    this.version = options.version;
    this.defaultData = options.defaultData;
    this.migrations = options.migrations || [];
    this.debug = options.debug || false;

    // Sort migrations by version
    this.migrations.sort((a, b) => a.fromVersion - b.fromVersion);
  }

  /**
   * Log debug messages
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug && process.env.NODE_ENV === 'development') {
      console.log(`[VersionedStorage:${this.key}] ${message}`, ...args);
    }
  }

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
   * Generate simple checksum for data integrity
   */
  private generateChecksum(data: unknown): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Verify data checksum
   */
  private verifyChecksum(schema: StorageSchema<T>): boolean {
    if (!schema.checksum) return true; // No checksum to verify
    return this.generateChecksum(schema.data) === schema.checksum;
  }

  /**
   * Apply migrations to data
   */
  private applyMigrations(data: unknown, fromVersion: number): T {
    let currentData = data;
    let currentVersion = fromVersion;

    for (const migration of this.migrations) {
      if (migration.fromVersion >= currentVersion && migration.toVersion <= this.version) {
        this.log(`Applying migration: v${migration.fromVersion} → v${migration.toVersion}`);
        try {
          currentData = migration.migrate(currentData);
          currentVersion = migration.toVersion;
        } catch (error) {
          this.log(`Migration failed: v${migration.fromVersion} → v${migration.toVersion}`, error);
          throw new Error(`Migration failed from v${migration.fromVersion} to v${migration.toVersion}`);
        }
      }
    }

    return currentData as T;
  }

  /**
   * Load data from storage
   */
  load(): StorageResult<T> {
    if (!this.isStorageAvailable()) {
      this.log('localStorage not available, using default data');
      return {
        success: true,
        data: this.defaultData,
        migrated: false,
      };
    }

    try {
      const raw = window.localStorage.getItem(this.key);
      
      if (!raw) {
        this.log('No stored data, using defaults');
        return {
          success: true,
          data: this.defaultData,
          migrated: false,
        };
      }

      const schema: StorageSchema<T> = JSON.parse(raw);

      // Verify checksum
      if (!this.verifyChecksum(schema)) {
        this.log('Checksum mismatch, data may be corrupted');
        return {
          success: false,
          data: this.defaultData,
          migrated: false,
          error: new Error('Data integrity check failed'),
        };
      }

      // Check if migration needed
      if (schema.version < this.version) {
        this.log(`Migrating from v${schema.version} to v${this.version}`);
        const migratedData = this.applyMigrations(schema.data, schema.version);
        
        // Save migrated data
        this.save(migratedData);
        
        return {
          success: true,
          data: migratedData,
          migrated: true,
          fromVersion: schema.version,
        };
      }

      // Version matches, return data directly
      this.log('Loaded data successfully');
      return {
        success: true,
        data: schema.data,
        migrated: false,
      };

    } catch (error) {
      this.log('Failed to load data', error);
      return {
        success: false,
        data: this.defaultData,
        migrated: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Save data to storage
   */
  save(data: T): boolean {
    if (!this.isStorageAvailable()) {
      this.log('localStorage not available, cannot save');
      return false;
    }

    try {
      const schema: StorageSchema<T> = {
        version: this.version,
        data,
        savedAt: new Date().toISOString(),
        checksum: this.generateChecksum(data),
      };

      window.localStorage.setItem(this.key, JSON.stringify(schema));
      this.log('Saved data successfully');
      return true;

    } catch (error) {
      this.log('Failed to save data', error);
      
      // Try to handle quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.log('Storage quota exceeded');
      }
      
      return false;
    }
  }

  /**
   * Clear stored data
   */
  clear(): boolean {
    if (!this.isStorageAvailable()) {
      return false;
    }

    try {
      window.localStorage.removeItem(this.key);
      this.log('Cleared stored data');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if data exists in storage
   */
  exists(): boolean {
    if (!this.isStorageAvailable()) {
      return false;
    }
    return window.localStorage.getItem(this.key) !== null;
  }

  /**
   * Get the raw stored data without parsing
   */
  getRaw(): string | null {
    if (!this.isStorageAvailable()) {
      return null;
    }
    return window.localStorage.getItem(this.key);
  }

  /**
   * Get storage info (size, version)
   */
  getInfo(): { size: number; version: number | null; savedAt: string | null } {
    const raw = this.getRaw();
    if (!raw) {
      return { size: 0, version: null, savedAt: null };
    }

    try {
      const schema: StorageSchema = JSON.parse(raw);
      return {
        size: new Blob([raw]).size,
        version: schema.version,
        savedAt: schema.savedAt,
      };
    } catch {
      return { size: new Blob([raw]).size, version: null, savedAt: null };
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a versioned storage instance
 */
export function createStorage<T>(options: StorageOptions<T>): VersionedStorage<T> {
  return new VersionedStorage(options);
}

// =============================================================================
// EXPORTS
// =============================================================================

const storageUtils = {
  VersionedStorage,
  createStorage,
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEYS,
};

export default storageUtils;
