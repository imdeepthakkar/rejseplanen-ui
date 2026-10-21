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
