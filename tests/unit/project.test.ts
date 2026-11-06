import { describe, it, expect } from 'vitest';
import { projectNameOf, brandText, titleFor, PRODUCT_NAME } from '../../lab/lib/project.js';

describe('projectNameOf', () => {
  it('reads the name from project.json, trimmed', () => {
    expect(projectNameOf({ name: 'Jane Street' })).toBe('Jane Street');
    expect(projectNameOf({ name: '  Acme  ' })).toBe('Acme');
  });
  it('has none when there is no file, no name, or a name that is not usable', () => {
    expect(projectNameOf(undefined)).toBeUndefined();
    expect(projectNameOf(null)).toBeUndefined();
    expect(projectNameOf('Jane Street')).toBeUndefined();
    expect(projectNameOf({})).toBeUndefined();
    expect(projectNameOf({ name: '' })).toBeUndefined();
    expect(projectNameOf({ name: '   ' })).toBeUndefined();
    expect(projectNameOf({ name: 42 })).toBeUndefined();
    expect(projectNameOf({ name: 'x'.repeat(61) })).toBeUndefined();
  });
});

describe('brandText and titleFor', () => {
  it('say Motion Lab alone, or after the project', () => {
    expect(brandText()).toBe(PRODUCT_NAME);
    expect(brandText('Jane Street')).toBe('Jane Street · Motion Lab');
  });
  it('put what is on screen first in the tab title', () => {
    expect(titleFor('card')).toBe('card – Motion Lab');
    expect(titleFor('card', 'Jane Street')).toBe('card – Jane Street · Motion Lab');
    expect(titleFor('')).toBe('Motion Lab');
  });
});
