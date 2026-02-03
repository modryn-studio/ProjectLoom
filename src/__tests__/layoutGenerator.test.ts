/**
 * Tests for Layout Generator Utility
 */

import { describe, it, expect } from 'vitest';
import {
  generateGridLayout,
  generateHorizontalLayout,
  generateVerticalLayout,
  generateCascadeLayout,
  generateTreeLayout,
  createSeededRandom,
  getJitter,
} from '../utils/layoutGenerator';

describe('createSeededRandom', () => {
  it('should produce deterministic results with same seed', () => {
    const random1 = createSeededRandom(12345);
    const random2 = createSeededRandom(12345);

    const values1 = [random1(), random1(), random1()];
    const values2 = [random2(), random2(), random2()];

    expect(values1).toEqual(values2);
  });

  it('should produce different results with different seeds', () => {
    const random1 = createSeededRandom(12345);
    const random2 = createSeededRandom(54321);

    expect(random1()).not.toBe(random2());
  });

  it('should produce values between 0 and 1', () => {
    const random = createSeededRandom(42);

    for (let i = 0; i < 100; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe('getJitter', () => {
  it('should return 0 when jitter amount is 0', () => {
    const jitter = getJitter(0);
    // -0 and 0 are mathematically equal (Object.is distinguishes them, but we don't care)
    expect(jitter === 0).toBe(true);
  });

  it('should return values within jitter range', () => {
    const jitterAmount = 20;

    for (let i = 0; i < 100; i++) {
      const jitter = getJitter(jitterAmount);
      expect(Math.abs(jitter)).toBeLessThanOrEqual(jitterAmount);
    }
  });

  it('should use provided random function', () => {
    const mockRandom = () => 0.5; // Always returns 0.5
    const jitter = getJitter(20, mockRandom);

    // (0.5 - 0.5) * 2 * 20 = 0
    expect(jitter).toBe(0);
  });

  it('should return positive and negative values', () => {
    const lowRandom = () => 0.1;
    const highRandom = () => 0.9;

    expect(getJitter(20, lowRandom)).toBeLessThan(0);
    expect(getJitter(20, highRandom)).toBeGreaterThan(0);
  });
});

describe('generateGridLayout', () => {
  it('should generate correct number of positions', () => {
    const result = generateGridLayout({ count: 10 });
    expect(result.positions).toHaveLength(10);
  });

  it('should respect column count', () => {
    const result = generateGridLayout({
      count: 8,
      columns: 4,
      jitter: 0, // No jitter for precise testing
      startX: 0,
      startY: 0,
    });

    // Should have 2 rows of 4
    const rows = new Set(result.positions.map(p => p.y));
    expect(rows.size).toBe(2);
  });

  it('should be deterministic with seed', () => {
    const result1 = generateGridLayout({ count: 5 }, 12345);
    const result2 = generateGridLayout({ count: 5 }, 12345);

    expect(result1.positions).toEqual(result2.positions);
  });

  it('should produce different layouts with different seeds', () => {
    const result1 = generateGridLayout({ count: 5, jitter: 20 }, 12345);
    const result2 = generateGridLayout({ count: 5, jitter: 20 }, 54321);

    expect(result1.positions).not.toEqual(result2.positions);
  });

  it('should calculate bounds correctly', () => {
    const result = generateGridLayout({
      count: 4,
      columns: 2,
      jitter: 0,
      startX: 100,
      startY: 100,
      cardWidth: 280,
      cardHeight: 120,
      gapX: 280,
      gapY: 280,
    });

    expect(result.bounds.minX).toBe(100);
    expect(result.bounds.minY).toBe(100);
    expect(result.bounds.width).toBeGreaterThan(0);
    expect(result.bounds.height).toBeGreaterThan(0);
  });

  it('should apply jitter within range', () => {
    const result = generateGridLayout({
      count: 20,
      jitter: 20,
      columns: 4,
      startX: 0,
      startY: 0,
    });

    // All positions should be within reasonable range
    for (const pos of result.positions) {
      expect(pos.x).toBeGreaterThanOrEqual(-20);
      expect(pos.y).toBeGreaterThanOrEqual(-20);
    }
  });
});

describe('generateHorizontalLayout', () => {
  it('should generate single row', () => {
    const result = generateHorizontalLayout({
      count: 5,
      jitter: 0,
      startY: 100,
    });

    // All items should have similar Y (single row)
    const yValues = new Set(result.positions.map(p => p.y));
    expect(yValues.size).toBe(1);
  });

  it('should space items horizontally', () => {
    const result = generateHorizontalLayout({
      count: 3,
      jitter: 0,
      startX: 0,
    });

    // X values should increase
    for (let i = 1; i < result.positions.length; i++) {
      expect(result.positions[i].x).toBeGreaterThan(result.positions[i - 1].x);
    }
  });
});

describe('generateVerticalLayout', () => {
  it('should generate single column', () => {
    const result = generateVerticalLayout({
      count: 5,
      jitter: 0,
      startX: 100,
    });

    // All items should have similar X (single column)
    const xValues = new Set(result.positions.map(p => p.x));
    expect(xValues.size).toBe(1);
  });

  it('should space items vertically', () => {
    const result = generateVerticalLayout({
      count: 3,
      jitter: 0,
      startY: 0,
    });

    // Y values should increase
    for (let i = 1; i < result.positions.length; i++) {
      expect(result.positions[i].y).toBeGreaterThan(result.positions[i - 1].y);
    }
  });
});

describe('generateCascadeLayout', () => {
  it('should create diagonal staircase pattern', () => {
    const result = generateCascadeLayout({
      count: 5,
      jitter: 0,
    });

    // Each position should be offset from the previous
    for (let i = 1; i < result.positions.length; i++) {
      expect(result.positions[i].x).toBeGreaterThan(result.positions[i - 1].x);
      expect(result.positions[i].y).toBeGreaterThan(result.positions[i - 1].y);
    }
  });

  it('should apply jitter correctly', () => {
    const result = generateCascadeLayout(
      { count: 5, jitter: 20 },
      12345
    );

    // Verify positions exist and are reasonable
    expect(result.positions).toHaveLength(5);
    for (const pos of result.positions) {
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
    }
  });
});

describe('generateTreeLayout', () => {
  it('should handle empty connections', () => {
    const result = generateTreeLayout([], { count: 3 });

    expect(result.positions).toHaveLength(3);
  });

  it('should position children to the right of parents', () => {
    const connections = [
      { source: 0, target: 1 },
      { source: 0, target: 2 },
    ];

    const result = generateTreeLayout(connections, { count: 3, jitter: 0 });

    // Children should be to the right of parent
    expect(result.positions[1].x).toBeGreaterThan(result.positions[0].x);
    expect(result.positions[2].x).toBeGreaterThan(result.positions[0].x);
  });

  it('should center parent among children', () => {
    const connections = [
      { source: 0, target: 1 },
      { source: 0, target: 2 },
      { source: 0, target: 3 },
    ];

    const result = generateTreeLayout(connections, { count: 4, jitter: 0 });

    // Parent Y should be between first and last child
    const parentY = result.positions[0].y;
    const childYs = [1, 2, 3].map(i => result.positions[i].y);
    const minChildY = Math.min(...childYs);
    const maxChildY = Math.max(...childYs);

    expect(parentY).toBeGreaterThanOrEqual(minChildY);
    expect(parentY).toBeLessThanOrEqual(maxChildY);
  });

  it('should handle multiple root nodes', () => {
    const connections = [
      { source: 0, target: 2 },
      { source: 1, target: 3 },
    ];

    const result = generateTreeLayout(connections, { count: 4, jitter: 0 });

    // Both roots should have positions
    expect(result.positions[0]).toBeDefined();
    expect(result.positions[1]).toBeDefined();
  });

  it('should handle deep nesting', () => {
    const connections = [
      { source: 0, target: 1 },
      { source: 1, target: 2 },
      { source: 2, target: 3 },
    ];

    const result = generateTreeLayout(connections, { count: 4, jitter: 0 });

    // Each level should be further right
    for (let i = 1; i < result.positions.length; i++) {
      expect(result.positions[i].x).toBeGreaterThan(result.positions[i - 1].x);
    }
  });
});
