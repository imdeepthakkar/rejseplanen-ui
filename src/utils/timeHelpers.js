export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function timeDifferenceMinutes(startStr, endStr) {
  let start = timeToMinutes(startStr);
  let end = timeToMinutes(endStr);
  if (end < start) {
    end += 24 * 60; // wrapped midnight
  }
  return end - start;
}

export function formatDuration(totalMinutes) {
  const minsNum = Number(totalMinutes);
  if (isNaN(minsNum) || minsNum <= 0) {
    return '0 Mins';
  }

  const hours = Math.floor(minsNum / 60);
  const mins = minsNum % 60;

  if (hours === 0) {
    return `${mins} ${mins === 1 ? 'Min' : 'Mins'}`;
  }

  const hrUnit = hours === 1 ? 'Hr' : 'Hrs';
  if (mins === 0) {
    return `${hours} ${hrUnit}`;
  }

  const minUnit = mins === 1 ? 'Min' : 'Mins';
  return `${hours} ${hrUnit} ${mins} ${minUnit}`;
}

export function parseRejseplanenDateTime(dateStr, timeStr) {
  if (!dateStr && !timeStr) return null;

  let year = 1970;
  let month = 0; // 0-indexed
  let day = 1;

  if (dateStr) {
    if (dateStr.includes('.')) {
      // DD.MM.YY or DD.MM.YYYY
      const parts = dateStr.split('.').map(Number);
      day = parts[0];
      month = parts[1] - 1;
      year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
    } else if (dateStr.includes('-')) {
      // YYYY-MM-DD
      const parts = dateStr.split('-').map(Number);
      year = parts[0];
      month = parts[1] - 1;
      day = parts[2];
    }
  }

  let hours = 0;
  let minutes = 0;
  if (timeStr) {
    const parts = timeStr.split(':').map(Number);
    hours = parts[0] || 0;
    minutes = parts[1] || 0;
  }

  return new Date(year, month, day, hours, minutes, 0, 0);
}

export function getDateTimeTimestamp(timeStr, dateStr, now = new Date()) {
  if (dateStr && timeStr) {
    const parsed = parseRejseplanenDateTime(dateStr, timeStr);
    if (parsed) return parsed.getTime();
  }

  if (timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const depTotal = h * 60 + m;
    const nowTotal = now.getHours() * 60 + now.getMinutes();
    let diff = depTotal - nowTotal;

    // Handle midnight rollover
    if (diff < -720) {
      diff += 1440;
    } else if (diff > 720) {
      diff -= 1440;
    }

    return now.getTime() + diff * 60 * 1000;
  }

  return 0;
}

export function compareDeparturesChronological(a, b, now = new Date()) {
  const timeA = getDateTimeTimestamp(a?.time, a?.date, now);
  const timeB = getDateTimeTimestamp(b?.time, b?.date, now);
  return timeA - timeB;
}

export function compareTripsChronological(a, b, now = new Date()) {
  const getLegOrigin = (trip) => {
    const legs = Array.isArray(trip?.Leg) ? trip.Leg : (trip?.Leg ? [trip.Leg] : []);
    return legs[0]?.Origin;
  };

  const originA = getLegOrigin(a);
  const originB = getLegOrigin(b);

  const timeA = getDateTimeTimestamp(originA?.time, originA?.date, now);
  const timeB = getDateTimeTimestamp(originB?.time, originB?.date, now);
  return timeA - timeB;
}

