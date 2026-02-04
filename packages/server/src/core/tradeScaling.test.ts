import { describe, it, expect } from 'vitest';

// Constants from tradeDispatcher
const MIN_SCALE_FACTOR = 0.1;
const MAX_SCALE_FACTOR = 2.0;

// Pure function to calculate dynamic scale factor based on NAV ratio
function calculateDynamicScale(sourceNav: number, mirrorNav: number): number {
  if (sourceNav <= 0) {
    throw new Error('Source NAV must be positive');
  }

  let dynamicScale = mirrorNav / sourceNav;

  // Apply guardrails
  dynamicScale = Math.max(MIN_SCALE_FACTOR, Math.min(MAX_SCALE_FACTOR, dynamicScale));

  return dynamicScale;
}

// Calculate scaled units for a trade
function calculateScaledUnits(originalUnits: number, scaleFactor: number): number {
  return Math.round(originalUnits * scaleFactor);
}

describe('Dynamic Scale Factor Calculation', () => {
  it('should calculate 1:1 scale when NAVs are equal', () => {
    const scale = calculateDynamicScale(10000, 10000);
    expect(scale).toBe(1.0);
  });

  it('should calculate 0.5x scale when mirror NAV is half of source', () => {
    const scale = calculateDynamicScale(10000, 5000);
    expect(scale).toBe(0.5);
  });

  it('should calculate 2x scale when mirror NAV is double source', () => {
    const scale = calculateDynamicScale(10000, 20000);
    expect(scale).toBe(2.0);
  });

  it('should cap scale factor at MAX_SCALE_FACTOR (2.0)', () => {
    const scale = calculateDynamicScale(10000, 50000);
    expect(scale).toBe(MAX_SCALE_FACTOR);
  });

  it('should floor scale factor at MIN_SCALE_FACTOR (0.1)', () => {
    const scale = calculateDynamicScale(10000, 500);
    expect(scale).toBe(MIN_SCALE_FACTOR);
  });

  it('should throw error when source NAV is zero', () => {
    expect(() => calculateDynamicScale(0, 10000)).toThrow('Source NAV must be positive');
  });

  it('should throw error when source NAV is negative', () => {
    expect(() => calculateDynamicScale(-1000, 10000)).toThrow('Source NAV must be positive');
  });
});

describe('Scaled Units Calculation', () => {
  it('should scale units by factor and round to nearest integer', () => {
    expect(calculateScaledUnits(1000, 1.0)).toBe(1000);
    expect(calculateScaledUnits(1000, 0.5)).toBe(500);
    expect(calculateScaledUnits(1000, 2.0)).toBe(2000);
  });

  it('should round fractional units correctly', () => {
    expect(calculateScaledUnits(1000, 0.333)).toBe(333);
    expect(calculateScaledUnits(1000, 0.335)).toBe(335);
    expect(calculateScaledUnits(1000, 0.3333)).toBe(333);
  });

  it('should handle negative units (sell orders)', () => {
    expect(calculateScaledUnits(-1000, 0.5)).toBe(-500);
    expect(calculateScaledUnits(-1000, 2.0)).toBe(-2000);
  });

  it('should return 0 for 0 units', () => {
    expect(calculateScaledUnits(0, 1.5)).toBe(0);
  });
});
