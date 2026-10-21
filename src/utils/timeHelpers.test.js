import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  timeDifferenceMinutes,
  formatDuration,
  parseRejseplanenDateTime,
  getDateTimeTimestamp,
  compareDeparturesChronological,
  compareTripsChronological
} from './timeHelpers';

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

  describe('parseRejseplanenDateTime', () => {
    it('parses DD.MM.YY and HH:MM correctly', () => {
      const d = parseRejseplanenDateTime('21.10.26', '19:46');
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(9); // 0-indexed October
      expect(d.getDate()).toBe(21);
      expect(d.getHours()).toBe(19);
      expect(d.getMinutes()).toBe(46);
    });

    it('parses DD.MM.YYYY and YYYY-MM-DD correctly', () => {
      const d1 = parseRejseplanenDateTime('22.10.2026', '00:06');
      expect(d1.getFullYear()).toBe(2026);
      expect(d1.getDate()).toBe(22);
      expect(d1.getHours()).toBe(0);
      expect(d1.getMinutes()).toBe(6);

      const d2 = parseRejseplanenDateTime('2026-10-22', '00:06');
      expect(d2.getFullYear()).toBe(2026);
      expect(d2.getDate()).toBe(22);
      expect(d2.getHours()).toBe(0);
      expect(d2.getMinutes()).toBe(6);
    });

    it('handles missing or invalid inputs gracefully', () => {
      expect(parseRejseplanenDateTime(null, null)).toBeNull();
      expect(parseRejseplanenDateTime('', '')).toBeNull();
    });
  });

  describe('getDateTimeTimestamp', () => {
    it('returns exact millisecond timestamp when date and time are provided', () => {
      const ts1 = getDateTimeTimestamp('19:46', '21.10.26');
      const ts2 = getDateTimeTimestamp('00:06', '22.10.26');
      expect(ts2).toBeGreaterThan(ts1);
      expect((ts2 - ts1) / (1000 * 60)).toBe(260); // 4 hours 20 minutes
    });

    it('infers timestamp relative to reference time when date is omitted with midnight rollover', () => {
      const refTime = new Date(2026, 9, 21, 19, 46, 0);
      const tsTonight = getDateTimeTimestamp('20:00', null, refTime);
      const tsMidnight = getDateTimeTimestamp('00:06', null, refTime);

      expect(tsMidnight).toBeGreaterThan(tsTonight);
      expect((tsMidnight - refTime.getTime()) / (1000 * 60)).toBe(260);
    });
  });

  describe('compareDeparturesChronological', () => {
    it('sorts departures spanning across midnight in true chronological order', () => {
      const deps = [
        { name: 'Bus 165', time: '00:06', date: '22.10.26', direction: 'Hækmosen' },
        { name: 'Bus 165', time: '00:14', date: '22.10.26', direction: 'Herlev St.' },
        { name: 'Bus 165', time: '19:46', date: '21.10.26', direction: 'Bagsværd St.' },
        { name: 'Bus 165', time: '23:44', date: '21.10.26', direction: 'Herlev St.' },
      ];

      const sorted = [...deps].sort(compareDeparturesChronological);

      expect(sorted[0].time).toBe('19:46');
      expect(sorted[1].time).toBe('23:44');
      expect(sorted[2].time).toBe('00:06');
      expect(sorted[3].time).toBe('00:14');
    });

    it('sorts departures without dates relative to current time across midnight', () => {
      const refTime = new Date(2026, 9, 21, 19, 46, 0);
      const deps = [
        { name: 'Bus 165', time: '00:06' },
        { name: 'Bus 165', time: '19:50' },
      ];

      const sorted = [...deps].sort((a, b) => compareDeparturesChronological(a, b, refTime));

      expect(sorted[0].time).toBe('19:50');
      expect(sorted[1].time).toBe('00:06');
    });
  });

  describe('compareTripsChronological', () => {
    it('sorts journeys chronologically by origin leg date and time', () => {
      const trips = [
        { Leg: [{ Origin: { time: '00:15', date: '22.10.26' }, Destination: { time: '00:45' } }] },
        { Leg: [{ Origin: { time: '19:50', date: '21.10.26' }, Destination: { time: '20:20' } }] },
      ];

      const sorted = [...trips].sort(compareTripsChronological);

      expect(sorted[0].Leg[0].Origin.time).toBe('19:50');
      expect(sorted[1].Leg[0].Origin.time).toBe('00:15');
    });
  });
});
