import { describe, it, expect } from 'vitest';
import { timeToMinutes, timeDifferenceMinutes, formatDuration } from './timeHelpers';

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

  describe('formatDuration', () => {
    it('formats hours and minutes in English format like "1 Hr 20 Mins"', () => {
      expect(formatDuration(80)).toBe('1 Hr 20 Mins');
      expect(formatDuration(140)).toBe('2 Hrs 20 Mins');
    });

    it('formats exact hours with correct singular and plural units', () => {
      expect(formatDuration(60)).toBe('1 Hr');
      expect(formatDuration(120)).toBe('2 Hrs');
      expect(formatDuration(180)).toBe('3 Hrs');
    });

    it('formats sub-hour durations with singular and plural units', () => {
      expect(formatDuration(1)).toBe('1 Min');
      expect(formatDuration(20)).toBe('20 Mins');
      expect(formatDuration(45)).toBe('45 Mins');
    });

    it('handles 1 minute remainder over hours correctly', () => {
      expect(formatDuration(61)).toBe('1 Hr 1 Min');
      expect(formatDuration(121)).toBe('2 Hrs 1 Min');
    });

    it('handles zero, negative, and invalid values gracefully', () => {
      expect(formatDuration(0)).toBe('0 Mins');
      expect(formatDuration(-15)).toBe('0 Mins');
      expect(formatDuration(null)).toBe('0 Mins');
      expect(formatDuration(undefined)).toBe('0 Mins');
    });
  });
});
