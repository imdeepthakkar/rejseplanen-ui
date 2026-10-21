import { describe, it, expect } from 'vitest';
import { classifyDeparture, MODE_KEYS, TRANSPORT_MODES } from './transportModes';

describe('transportModes', () => {
  it('defines the 6 required modes with correct colors and metadata', () => {
    expect(MODE_KEYS).toEqual(['ALL', 'BUS', 'S_TOG', 'METRO', 'RE', 'LETBANE']);
    expect(TRANSPORT_MODES.BUS.background).toBe('#FFC627');
    expect(TRANSPORT_MODES.BUS.color).toBe('#111827');
    expect(TRANSPORT_MODES.S_TOG.background).toBe('#C8102E');
    expect(TRANSPORT_MODES.LETBANE.background).toBe('#10B981');
    expect(TRANSPORT_MODES.METRO.iconType).toBe('metro-m');
    expect(TRANSPORT_MODES.RE.iconType).toBe('train-re');
  });

  it('classifies S-tog correctly', () => {
    expect(classifyDeparture({ type: 'S', name: 'A' })).toBe('S_TOG');
    expect(classifyDeparture({ type: 'S', name: 'B' })).toBe('S_TOG');
  });

  it('classifies Metro correctly', () => {
    expect(classifyDeparture({ type: 'M', name: 'Metro M1' })).toBe('METRO');
    expect(classifyDeparture({ type: 'M', name: 'M3' })).toBe('METRO');
    expect(classifyDeparture({ type: 'TOG', name: 'M4' })).toBe('METRO');
  });

  it('classifies Buses correctly', () => {
    expect(classifyDeparture({ type: 'BUS', name: '5C' })).toBe('BUS');
    expect(classifyDeparture({ type: 'EXB', name: '150S' })).toBe('BUS');
    expect(classifyDeparture({ type: 'BUS', name: 'Havnebus 991' })).toBe('BUS');
  });

  it('classifies Letbane correctly', () => {
    expect(classifyDeparture({ type: 'LET', name: 'L2' })).toBe('LETBANE');
    expect(classifyDeparture({ type: 'TB', name: 'Letbane L1' })).toBe('LETBANE');
    expect(classifyDeparture({ type: 'TOG', name: 'Aarhus Letbane' })).toBe('LETBANE');
  });

  it('classifies Regional and Intercity trains correctly', () => {
    expect(classifyDeparture({ type: 'REG', name: 'Re 1234' })).toBe('RE');
    expect(classifyDeparture({ type: 'IC', name: 'IC 871' })).toBe('RE');
    expect(classifyDeparture({ type: 'ICL', name: 'ICL 23' })).toBe('RE');
    expect(classifyDeparture({ type: 'TOG', name: 'ICE 10934' })).toBe('RE');
    expect(classifyDeparture({ type: 'TOG', name: 'Öresundståg 1123' })).toBe('RE');
  });
});
