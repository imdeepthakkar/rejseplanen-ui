export const getTransportStyle = (type, name) => {
  let background = '#0019a8'; // Default generic blue
  let color = '#ffffff';

  // S-tog (S-train) - Distinct Red
  if (type === 'S') {
    background = '#c8102E';
    color = '#ffffff';
  } 
  // Metro - M1, M2, M3, M4 or generic M
  else if (type === 'M') {
    if (name?.includes('M1')) background = '#00703C'; // Green
    else if (name?.includes('M2')) background = '#F3D03E'; // Yellow
    else if (name?.includes('M3')) background = '#EA3753'; // Red (Cityringen)
    else if (name?.includes('M4')) background = '#1EA6DA'; // Blue
    else background = '#e51937';
    if (name?.includes('M2')) color = '#111111';
  } 
  // Bus (Denmark Bus / Havnebus)
  else if (type === 'BUS' || type === 'EXB' || name?.toLowerCase().includes('havnebus')) {
    // S-bus (e.g. 5C, 250S)
    if (name?.endsWith('S') || name?.endsWith('C')) {
      background = '#1A90D9'; // Blue-ish for C/S buses
    } else {
      background = '#FFC627'; // Standard Movia Yellow
      color = '#111111';
    }
  } 
  // Oresundstog
  else if (name?.toLowerCase().includes('öresund') || name?.toLowerCase().includes('oresund')) {
    background = '#8A8D8F'; // Silver/Grey
    color = '#ffffff';
  } 
  // Regional / Intercity / Train
  else if (type === 'REG' || type === 'IC' || type === 'ICL' || type === 'TOG') {
    background = '#001D4A'; // DSB Dark Blue
    color = '#ffffff';
  }
  // Walk
  else if (type === 'WALK') {
    background = '#a6b8c7'; // Soft grey
    color = '#17243F';
  }

  return { background, color };
};
