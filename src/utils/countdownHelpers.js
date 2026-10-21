export function getLiveCountdown(timeStr, rtTimeStr, now = new Date()) {
  if (!timeStr) {
    return { text: '--', minutes: 0, isDelayed: false, isImminent: false };
  }

  const effectiveTime = rtTimeStr || timeStr;
  const isDelayed = Boolean(rtTimeStr && rtTimeStr !== timeStr);

  const [depHours, depMinutes] = effectiveTime.split(':').map(Number);
  const nowHours = now.getHours();
  const nowMinutes = now.getMinutes();

  const depTotal = depHours * 60 + depMinutes;
  const nowTotal = nowHours * 60 + nowMinutes;

  let diff = depTotal - nowTotal;

  // Handle midnight roll-over (e.g., now is 23:55, departure is 00:10)
  if (diff < -720) {
    diff += 1440;
  } else if (diff > 720) {
    diff -= 1440;
  }

  const isImminent = diff <= 2;

  let text;
  if (diff <= 0) {
    text = 'Now';
  } else if (diff === 1) {
    text = '1 min';
  } else if (diff < 60) {
    text = `${diff} min`;
  } else {
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    text = `${hours}t ${mins}m`;
  }

  return {
    text,
    minutes: Math.max(0, diff),
    isDelayed,
    isImminent,
  };
}
