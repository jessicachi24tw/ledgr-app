import { describe, it, expect } from 'vitest';
import { yourShare, evenSplitOwed } from './split';

describe('yourShare', () => {
  it('returns the full amount when there is no split', () => {
    expect(yourShare({ amount: 100 })).toBe(100);
    expect(yourShare({ amount: 100, splitOwed: 0 })).toBe(100);
  });

  it('subtracts what others owe from the full amount', () => {
    expect(yourShare({ amount: 120, splitOwed: 80 })).toBe(40);
  });

  it('never goes negative if splitOwed exceeds the amount (bad manual entry)', () => {
    expect(yourShare({ amount: 50, splitOwed: 200 })).toBe(0);
  });
});

describe('evenSplitOwed', () => {
  it('splits evenly among multiple people, excluding the payer\'s own share', () => {
    expect(evenSplitOwed(120, 3)).toBeCloseTo(80);
    expect(evenSplitOwed(100, 2)).toBeCloseTo(50);
  });

  it('returns 0 when there is only 1 person (nothing to split)', () => {
    expect(evenSplitOwed(100, 1)).toBe(0);
  });

  it('returns 0 for a 0 or negative people count', () => {
    expect(evenSplitOwed(100, 0)).toBe(0);
    expect(evenSplitOwed(100, -2)).toBe(0);
  });

  it('returns 0 for a non-finite people count (e.g. NaN from an empty input)', () => {
    expect(evenSplitOwed(100, NaN)).toBe(0);
  });
});
