import { describe, it, expect } from 'vitest';
import { initialsOf } from '../../lab/lib/avatar.js';

describe('the avatar initials', () => {
  it('takes the first and last name', () => {
    expect(initialsOf('Maya Chen')).toBe('MC');
    expect(initialsOf('Maya Louise Chen')).toBe('MC');
  });
  it('takes one letter from one word, and splits handles', () => {
    expect(initialsOf('maya')).toBe('M');
    expect(initialsOf('maya.chen')).toBe('MC');
  });
  it('shows nothing when there is no name', () => {
    expect(initialsOf('')).toBe('');
    expect(initialsOf('  ')).toBe('');
    expect(initialsOf(undefined)).toBe('');
  });
});
