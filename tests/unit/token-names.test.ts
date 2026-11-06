import { describe, it, expect } from 'vitest';
import { tokenDisplayName, tokenValueText, nearestToken, VALUE_HEADERS, EXAMPLE_KINDS } from '../../lab/lib/token-names.js';

describe('tokenDisplayName', () => {
  it('joins the group and the name with a hyphen', () => {
    expect(tokenDisplayName('distance.24')).toBe('distance-24');
    expect(tokenDisplayName('duration.300')).toBe('duration-300');
    expect(tokenDisplayName('scale.95')).toBe('scale-95');
    expect(tokenDisplayName('opacity.04')).toBe('opacity-04');
    expect(tokenDisplayName('delay.70')).toBe('delay-70');
    expect(tokenDisplayName('bounce.25')).toBe('bounce-25');
  });
  it('drops the easing group word', () => {
    expect(tokenDisplayName('easing.productive-standard')).toBe('productive-standard');
    expect(tokenDisplayName('easing.expressive-exit')).toBe('expressive-exit');
    expect(tokenDisplayName('easing.linear')).toBe('linear');
  });
  it('leaves a literal value alone', () => {
    expect(tokenDisplayName('300ms')).toBe('300ms');
    expect(tokenDisplayName('ease-out')).toBe('ease-out');
  });
});

describe('tokenValueText', () => {
  it('writes the value as the spec sheet does, the unit left to the header', () => {
    expect(tokenValueText('duration', '300ms')).toBe('300');
    expect(tokenValueText('distance', '24px')).toBe('24');
    expect(tokenValueText('delay', '70ms')).toBe('70');
    expect(tokenValueText('scale', 0.95)).toBe('95');
    expect(tokenValueText('scale', 1.03)).toBe('103');
    expect(tokenValueText('opacity', 0.04)).toBe('4');
    expect(tokenValueText('bounce', 0.25)).toBe('0.25');
    expect(tokenValueText('easing', [0.2, 0, 0.38, 0.9])).toBe('0.2, 0, 0.38, 0.9');
  });
  it('names the unit in the header', () => {
    expect(VALUE_HEADERS['duration']).toBe('Value (ms)');
    expect(VALUE_HEADERS['distance']).toBe('Value (px)');
    expect(VALUE_HEADERS['scale']).toBe('Value (%)');
    expect(VALUE_HEADERS['easing']).toBe('Value');
  });
  it('has an example for easing, duration, distance and bounce only', () => {
    expect([...EXAMPLE_KINDS].sort()).toEqual(['bounce', 'distance', 'duration', 'easing']);
  });
});

describe('nearestToken', () => {
  const raw = { 'distance.4': '4px', 'distance.12': '12px', 'distance.20': '20px', 'distance.32': '32px', 'duration.250': '250ms', 'duration.400': '400ms', 'easing.x': [0, 0, 1, 1] };
  it('finds the token of a kind with the closest value, a tie going to the larger', () => {
    expect(nearestToken(raw, 'distance', 16)).toBe('distance.20');
    expect(nearestToken(raw, 'distance', 13)).toBe('distance.12');
    expect(nearestToken(raw, 'duration', 400)).toBe('duration.400');
    expect(nearestToken(raw, 'duration', 300)).toBe('duration.250');
  });
  it('is undefined for a kind with no tokens', () => {
    expect(nearestToken(raw, 'delay', 80)).toBeUndefined();
    expect(nearestToken({}, 'duration', 80)).toBeUndefined();
  });
});
