/**
 * Tests for Z-Index Constants
 */

import { describe, it, expect } from 'vitest';
import { zIndex, getCardZIndex, z } from '../constants/zIndex';

describe('zIndex', () => {
  describe('structure', () => {
    it('should have all required categories', () => {
      expect(zIndex.canvas).toBeDefined();
      expect(zIndex.cards).toBeDefined();
      expect(zIndex.ui).toBeDefined();
      expect(zIndex.overlay).toBeDefined();
      expect(zIndex.top).toBeDefined();
    });

    it('should have canvas layers', () => {
      expect(zIndex.canvas.base).toBeDefined();
      expect(zIndex.canvas.grid).toBeDefined();
      expect(zIndex.canvas.edges).toBeDefined();
      expect(zIndex.canvas.connectionLine).toBeDefined();
    });

    it('should have card layers', () => {
      expect(zIndex.cards.default).toBeDefined();
      expect(zIndex.cards.dragging).toBeDefined();
      expect(zIndex.cards.hover).toBeDefined();
      expect(zIndex.cards.selected).toBeDefined();
      expect(zIndex.cards.expanded).toBeDefined();
    });
  });

  describe('hierarchy', () => {
    it('should maintain canvas layer order', () => {
      expect(zIndex.canvas.base).toBeLessThan(zIndex.canvas.grid);
      expect(zIndex.canvas.grid).toBeLessThan(zIndex.canvas.edges);
      expect(zIndex.canvas.edges).toBeLessThan(zIndex.canvas.connectionLine);
    });

    it('should maintain card layer order', () => {
      expect(zIndex.cards.default).toBeLessThan(zIndex.cards.hover);
      expect(zIndex.cards.hover).toBeLessThan(zIndex.cards.selected);
      expect(zIndex.cards.selected).toBeLessThan(zIndex.cards.dragging);
      expect(zIndex.cards.dragging).toBeLessThan(zIndex.cards.expanded);
    });

    it('should have cards above canvas', () => {
      expect(zIndex.cards.default).toBeGreaterThan(zIndex.canvas.connectionLine);
    });

    it('should have UI above cards', () => {
      expect(zIndex.ui.minimap).toBeGreaterThan(zIndex.cards.expanded);
    });

    it('should have overlays above UI', () => {
      expect(zIndex.overlay.devOverlay).toBeGreaterThan(zIndex.ui.dropdown);
    });

    it('should have tooltips at the top', () => {
      expect(zIndex.top.tooltip).toBeGreaterThan(zIndex.overlay.notification);
    });

    it('should have error boundary at the highest level', () => {
      expect(zIndex.top.errorBoundary).toBeGreaterThan(zIndex.top.tooltip);
    });
  });

  describe('category ranges', () => {
    it('should have canvas layers in 0-99 range', () => {
      Object.values(zIndex.canvas).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(100);
      });
    });

    it('should have card layers in 100-199 range', () => {
      Object.values(zIndex.cards).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(100);
        expect(value).toBeLessThan(200);
      });
    });

    it('should have UI layers in 200-299 range', () => {
      Object.values(zIndex.ui).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(200);
        expect(value).toBeLessThan(300);
      });
    });

    it('should have overlay layers in 300-399 range', () => {
      Object.values(zIndex.overlay).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(300);
        expect(value).toBeLessThan(400);
      });
    });

    it('should have top layers at 400+', () => {
      Object.values(zIndex.top).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(400);
      });
    });
  });
});

describe('getCardZIndex', () => {
  it('should return default z-index when no state', () => {
    expect(getCardZIndex({})).toBe(zIndex.cards.default);
  });

  it('should return hover z-index when hovered', () => {
    expect(getCardZIndex({ isHovered: true })).toBe(zIndex.cards.hover);
  });

  it('should return selected z-index when selected', () => {
    expect(getCardZIndex({ isSelected: true })).toBe(zIndex.cards.selected);
  });

  it('should return dragging z-index when dragging', () => {
    expect(getCardZIndex({ isDragging: true })).toBe(zIndex.cards.dragging);
  });

  it('should return expanded z-index when expanded', () => {
    expect(getCardZIndex({ isExpanded: true })).toBe(zIndex.cards.expanded);
  });

  it('should prioritize expanded over other states', () => {
    expect(getCardZIndex({
      isExpanded: true,
      isDragging: true,
      isHovered: true,
      isSelected: true,
    })).toBe(zIndex.cards.expanded);
  });

  it('should prioritize dragging over hover and selected', () => {
    expect(getCardZIndex({
      isDragging: true,
      isHovered: true,
      isSelected: true,
    })).toBe(zIndex.cards.dragging);
  });

  it('should prioritize selected over hover', () => {
    expect(getCardZIndex({
      isSelected: true,
      isHovered: true,
    })).toBe(zIndex.cards.selected);
  });
});

describe('z helper', () => {
  it('should convert number to string', () => {
    expect(z(100)).toBe('100');
    expect(z(0)).toBe('0');
    expect(z(999)).toBe('999');
  });

  it('should work with zIndex values', () => {
    expect(z(zIndex.cards.default)).toBe('100');
    expect(z(zIndex.top.tooltip)).toBe('400');
  });
});
