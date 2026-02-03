/**
 * Tests for Versioned Storage Layer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VersionedStorage, createStorage, CURRENT_SCHEMA_VERSION } from '../lib/storage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] || null),
  };
})();

// Setup global mocks
beforeEach(() => {
  vi.stubGlobal('window', { localStorage: localStorageMock });
  localStorageMock.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VersionedStorage', () => {
  const defaultOptions = {
    key: 'test:storage',
    version: 1,
    defaultData: { items: [] as string[], count: 0 },
  };

  describe('load', () => {
    it('should return default data when storage is empty', () => {
      const storage = new VersionedStorage(defaultOptions);
      const result = storage.load();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(defaultOptions.defaultData);
      expect(result.migrated).toBe(false);
    });

    it('should load stored data correctly', () => {
      const testData = { items: ['a', 'b'], count: 2 };
      const schema = {
        version: 1,
        data: testData,
        savedAt: new Date().toISOString(),
      };
      localStorageMock.setItem('test:storage', JSON.stringify(schema));

      const storage = new VersionedStorage(defaultOptions);
      const result = storage.load();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(testData);
    });

    it('should handle corrupted JSON gracefully', () => {
      localStorageMock.setItem('test:storage', 'not valid json {{{');

      const storage = new VersionedStorage(defaultOptions);
      const result = storage.load();

      expect(result.success).toBe(false);
      expect(result.data).toEqual(defaultOptions.defaultData);
      expect(result.error).toBeDefined();
    });

    it('should detect checksum mismatch', () => {
      const schema = {
        version: 1,
        data: { items: [], count: 0 },
        savedAt: new Date().toISOString(),
        checksum: 'invalid_checksum',
      };
      localStorageMock.setItem('test:storage', JSON.stringify(schema));

      const storage = new VersionedStorage(defaultOptions);
      const result = storage.load();

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('integrity');
    });
  });

  describe('save', () => {
    it('should save data with version and checksum', () => {
      const storage = new VersionedStorage(defaultOptions);
      const testData = { items: ['test'], count: 1 };

      const success = storage.save(testData);

      expect(success).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test:storage',
        expect.stringContaining('"version":1')
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test:storage',
        expect.stringContaining('"checksum"')
      );
    });

    it('should include savedAt timestamp', () => {
      const storage = new VersionedStorage(defaultOptions);
      storage.save({ items: [], count: 0 });

      // Find the call that saved our data (filter out storage availability test calls)
      const dataCalls = localStorageMock.setItem.mock.calls.filter(
        (call: [string, string]) => call[0] === 'test:storage'
      );
      const savedData = JSON.parse(dataCalls[dataCalls.length - 1][1]);
      expect(savedData.savedAt).toBeDefined();
      expect(new Date(savedData.savedAt).getTime()).not.toBeNaN();
    });
  });

  describe('migrations', () => {
    it('should apply migration when version is older', () => {
      // Store v1 data
      const v1Data = { items: ['a', 'b'] };
      const schema = {
        version: 1,
        data: v1Data,
        savedAt: new Date().toISOString(),
      };
      localStorageMock.setItem('test:storage', JSON.stringify(schema));

      // Create v2 storage with migration
      const storage = new VersionedStorage({
        key: 'test:storage',
        version: 2,
        defaultData: { items: [] as string[], count: 0, newField: '' },
        migrations: [
          {
            fromVersion: 1,
            toVersion: 2,
            migrate: (data: unknown) => {
              const d = data as { items: string[] };
              return {
                ...d,
                count: d.items.length,
                newField: 'migrated',
              };
            },
          },
        ],
      });

      const result = storage.load();

      expect(result.success).toBe(true);
      expect(result.migrated).toBe(true);
      expect(result.fromVersion).toBe(1);
      expect(result.data).toEqual({
        items: ['a', 'b'],
        count: 2,
        newField: 'migrated',
      });
    });

    it('should apply multiple migrations in order', () => {
      const v1Data = { value: 10 };
      const schema = {
        version: 1,
        data: v1Data,
        savedAt: new Date().toISOString(),
      };
      localStorageMock.setItem('test:storage', JSON.stringify(schema));

      const storage = new VersionedStorage({
        key: 'test:storage',
        version: 3,
        defaultData: { value: 0, doubled: 0, tripled: 0 },
        migrations: [
          {
            fromVersion: 1,
            toVersion: 2,
            migrate: (data: unknown) => {
              const d = data as { value: number };
              return {
                ...d,
                doubled: d.value * 2,
              };
            },
          },
          {
            fromVersion: 2,
            toVersion: 3,
            migrate: (data: unknown) => {
              const d = data as { value: number; doubled: number };
              return {
                ...d,
                tripled: d.value * 3,
              };
            },
          },
        ],
      });

      const result = storage.load();

      expect(result.data).toEqual({
        value: 10,
        doubled: 20,
        tripled: 30,
      });
    });
  });

  describe('clear', () => {
    it('should remove stored data', () => {
      localStorageMock.setItem('test:storage', '{"version":1,"data":{}}');

      const storage = new VersionedStorage(defaultOptions);
      const success = storage.clear();

      expect(success).toBe(true);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test:storage');
    });
  });

  describe('exists', () => {
    it('should return true when data exists', () => {
      localStorageMock.setItem('test:storage', '{}');

      const storage = new VersionedStorage(defaultOptions);
      expect(storage.exists()).toBe(true);
    });

    it('should return false when no data exists', () => {
      const storage = new VersionedStorage(defaultOptions);
      expect(storage.exists()).toBe(false);
    });
  });

  describe('getInfo', () => {
    it('should return storage info', () => {
      const schema = {
        version: 1,
        data: { test: true },
        savedAt: '2026-02-02T00:00:00.000Z',
      };
      localStorageMock.setItem('test:storage', JSON.stringify(schema));

      const storage = new VersionedStorage(defaultOptions);
      const info = storage.getInfo();

      expect(info.version).toBe(1);
      expect(info.savedAt).toBe('2026-02-02T00:00:00.000Z');
      expect(info.size).toBeGreaterThan(0);
    });
  });
});

describe('createStorage', () => {
  it('should create a VersionedStorage instance', () => {
    const storage = createStorage({
      key: 'test',
      version: 1,
      defaultData: null,
    });

    expect(storage).toBeInstanceOf(VersionedStorage);
  });
});

describe('CURRENT_SCHEMA_VERSION', () => {
  it('should be defined and be a number', () => {
    expect(CURRENT_SCHEMA_VERSION).toBeDefined();
    expect(typeof CURRENT_SCHEMA_VERSION).toBe('number');
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });
});
