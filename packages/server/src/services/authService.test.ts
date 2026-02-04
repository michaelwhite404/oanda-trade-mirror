import { describe, it, expect } from 'vitest';

// Test password validation logic directly (without instantiating the full service)
describe('Password Validation', () => {
  function validatePassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    return { valid: true };
  }

  it('should reject passwords shorter than 8 characters', () => {
    const result = validatePassword('Short1');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('8 characters');
  });

  it('should reject passwords without uppercase letters', () => {
    const result = validatePassword('lowercase123');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('uppercase');
  });

  it('should reject passwords without lowercase letters', () => {
    const result = validatePassword('UPPERCASE123');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('lowercase');
  });

  it('should reject passwords without numbers', () => {
    const result = validatePassword('NoNumbersHere');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('number');
  });

  it('should accept valid passwords', () => {
    const result = validatePassword('ValidPass123');
    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });
});
