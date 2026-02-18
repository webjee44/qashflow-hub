import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn (classnames merge)', () => {
  it('merges simple class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('deduplicates conflicting tailwind classes', () => {
    // tailwind-merge keeps last conflicting class
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('handles undefined and null inputs', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b');
  });

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('');
  });
});
