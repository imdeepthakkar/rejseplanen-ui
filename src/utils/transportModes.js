export const MODE_KEYS = ['ALL', 'BUS', 'S_TOG', 'METRO', 'RE', 'LETBANE'];

export const TRANSPORT_MODES = {
  ALL: {
    id: 'ALL',
    label: 'All',
    background: '#475569',
    color: '#FFFFFF',
    iconType: 'all',
  },
  BUS: {
    id: 'BUS',
    label: 'Bus',
    background: '#FFC627',
    color: '#111827',
    iconType: 'bus',
  },
  S_TOG: {
    id: 'S_TOG',
    label: 'S-Tog',
    background: '#C8102E',
    color: '#FFFFFF',
    iconType: 's-tog',
  },
  METRO: {
    id: 'METRO',
    label: 'Metro',
    background: '#E51937',
    color: '#FFFFFF',
    iconType: 'metro-m',
  },
  RE: {
    id: 'RE',
    label: 'RE',
    background: '#001D4A',
    color: '#FFFFFF',
    iconType: 'train-re',
  },
  LETBANE: {
    id: 'LETBANE',
    label: 'LetBane',
    background: '#10B981',
    color: '#FFFFFF',
    iconType: 'letbane',
  },
};

export function classifyDeparture(departure) {
  if (!departure) return 'RE';
  const type = (departure.type || '').toUpperCase();
  const name = (departure.name || '').trim();
  const lowerName = name.toLowerCase();

  // 1. S-tog
  if (type === 'S') {
    return 'S_TOG';
  }

  // 2. Metro
  if (type === 'M' || lowerName.includes('metro') || /^M[1-4]\b/i.test(name)) {
    return 'METRO';
  }

  // 3. Letbane (Light Rail / Tram)
  if (
    type === 'LET' || 
    type === 'TB' || 
    lowerName.includes('letbane') || 
    lowerName.includes('tram') ||
    lowerName.includes('light rail')
  ) {
    return 'LETBANE';
  }

  // 4. Bus / Havnebus
  if (
    type === 'BUS' || 
    type === 'EXB' || 
    type === 'NB' || 
    type === 'TBUS' ||
    lowerName.includes('bus') || 
    lowerName.includes('havnebus')
  ) {
    return 'BUS';
  }

  // 5. Regional / Intercity / International trains
  return 'RE';
}

export function getAvailableModes(departures) {
  if (!Array.isArray(departures) || departures.length === 0) {
    return [TRANSPORT_MODES.ALL.id];
  }

  const detected = new Set();
  for (const dep of departures) {
    const mode = classifyDeparture(dep);
    if (mode && mode !== TRANSPORT_MODES.ALL.id) {
      detected.add(mode);
    }
  }

  const canonicalOrder = [
    TRANSPORT_MODES.ALL.id,
    TRANSPORT_MODES.BUS.id,
    TRANSPORT_MODES.S_TOG.id,
    TRANSPORT_MODES.METRO.id,
    TRANSPORT_MODES.RE.id,
    TRANSPORT_MODES.LETBANE.id
  ];

  return canonicalOrder.filter(modeId => modeId === TRANSPORT_MODES.ALL.id || detected.has(modeId));
}
