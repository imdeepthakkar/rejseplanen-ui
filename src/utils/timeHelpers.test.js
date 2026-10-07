import { describe, it, expect } from 'vitest';
import { timeToMinutes, timeDifferenceMinutes } from './timeHelpers';

describe('timeHelpers', () => {
  it('converts HH:MM to total minutes', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('01:30')).toBe(90);
    expect(timeToMinutes('18:45')).toBe(1125);
  });

  it('calculates minute differences accurately including past midnight', () => {
    expect(timeDifferenceMinutes('18:00', '19:15')).toBe(75);
    expect(timeDifferenceMinutes('23:45', '00:15')).toBe(30);
  });
});
