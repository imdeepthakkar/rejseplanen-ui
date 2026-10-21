import { describe, it, expect } from 'vitest';
import { getLiveCountdown } from './countdownHelpers';

describe('countdownHelpers', () => {
  it('returns "Now" when departure is in less than 1 minute or in the past', () => {
    const now = new Date(2026, 9, 21, 18, 30, 0); // 18:30
    const res = getLiveCountdown('18:30', null, now);
    expect(res.text).toBe('Now');
    expect(res.minutes).toBe(0);
    expect(res.isImminent).toBe(true);

    const pastRes = getLiveCountdown('18:28', null, now);
    expect(pastRes.text).toBe('Now');
    expect(pastRes.minutes).toBeLessThanOrEqual(0);
  });

  it('calculates remaining minutes correctly when on time', () => {
    const now = new Date(2026, 9, 21, 18, 30, 0);
    const res = getLiveCountdown('18:35', null, now);
    expect(res.text).toBe('5 min');
    expect(res.minutes).toBe(5);
    expect(res.isDelayed).toBe(false);
  });

  it('uses real-time time (rtTime) to compute countdown and flags delay', () => {
    const now = new Date(2026, 9, 21, 18, 30, 0);
    const res = getLiveCountdown('18:32', '18:36', now);
    expect(res.text).toBe('6 min');
    expect(res.minutes).toBe(6);
    expect(res.isDelayed).toBe(true);
  });

  it('formats hours and minutes when over 60 minutes in English format', () => {
    const now = new Date(2026, 9, 21, 18, 0, 0);
    const res = getLiveCountdown('19:25', null, now);
    expect(res.text).toBe('1 Hr 25 Mins');
    expect(res.minutes).toBe(85);

    const exactHourRes = getLiveCountdown('19:00', null, now);
    expect(exactHourRes.text).toBe('1 Hr');
    expect(exactHourRes.minutes).toBe(60);
  });

  it('handles midnight boundary gracefully', () => {
    const now = new Date(2026, 9, 21, 23, 55, 0); // 23:55
    const res = getLiveCountdown('00:05', null, now); // 00:05 next day
    expect(res.text).toBe('10 min');
    expect(res.minutes).toBe(10);
  });
});
