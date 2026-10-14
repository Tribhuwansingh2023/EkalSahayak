import { describe, it, expect } from 'vitest';
import { formatPercent, formatNumber, convertDigitsToLocal } from '../formatters';

describe('formatPercent (Phase 4 Bug 1 Verification)', () => {
  it('correctly formats decimal mastery values (0..1) as percentages', () => {
    // Phase 4 Bug 1 requirement: 0.6 -> 60%, 0.45 -> 45%, 0.006 -> 0.6%, 1.0 -> 100%
    expect(formatPercent(0.6, 'en', 'latin')).toBe('60%');
    expect(formatPercent(0.45, 'en', 'latin')).toBe('45%');
    expect(formatPercent(0.006, 'en', 'latin')).toBe('0.6%');
    expect(formatPercent(1.0, 'en', 'latin')).toBe('100%');
  });

  it('handles already-scaled percentage numbers gracefully (e.g. 60 -> 60%)', () => {
    expect(formatPercent(60, 'en', 'latin')).toBe('60%');
    expect(formatPercent(45, 'en', 'latin')).toBe('45%');
  });

  it('formats local numerals when toggle is enabled', () => {
    const hindiPercent = formatPercent(0.6, 'hi', 'local');
    // Devanagari 60%
    expect(hindiPercent).toContain('६०');

    const odiaPercent = formatPercent(0.6, 'or', 'local');
    // Odia 60%
    expect(odiaPercent).toContain('୬୦');
  });
});

describe('formatNumber and convertDigitsToLocal', () => {
  it('converts standard digits to local Odia and Hindi scripts', () => {
    expect(convertDigitsToLocal('123', 'or-IN')).toBe('୧୨୩');
    expect(convertDigitsToLocal('123', 'hi-IN')).toBe('१२३');
    expect(convertDigitsToLocal('123', 'kn-IN')).toBe('೧೨೩');
  });

  it('formats numbers with Latin vs Local digits', () => {
    expect(formatNumber(42, 'en', 'latin')).toBe('42');
    expect(formatNumber(42, 'hi', 'local')).toBe('४२');
  });
});
