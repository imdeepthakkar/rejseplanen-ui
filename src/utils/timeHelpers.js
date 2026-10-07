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
