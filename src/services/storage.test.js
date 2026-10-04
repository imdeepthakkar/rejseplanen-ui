import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDefaultTab,
  setDefaultTab,
  getFavorites,
  saveFavorite,
  deleteFavorite
} from './storage';

let store = {};
const localStorageMock = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { store = {}; }
};
globalThis.localStorage = localStorageMock;

describe('storage service', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('returns journey as default tab when unset', () => {
    expect(getDefaultTab()).toBe('journey');
  });

  it('persists and retrieves default tab', () => {
    setDefaultTab('departures');
    expect(getDefaultTab()).toBe('departures');
  });

  it('returns default home and work favorites', () => {
    const favs = getFavorites();
    expect(favs.length).toBeGreaterThanOrEqual(2);
    expect(favs.some(f => f.id === 'home')).toBe(true);
    expect(favs.some(f => f.id === 'work')).toBe(true);
  });

  it('updates an existing favorite station', () => {
    saveFavorite({ id: 'home', label: 'Home', icon: '🏠', station: 'København H' });
    const favs = getFavorites();
    const home = favs.find(f => f.id === 'home');
    expect(home.station).toBe('København H');
  });

  it('adds a new custom favorite place and deletes it', () => {
    saveFavorite({ id: 'gym', label: 'Gym', icon: '🏋️', station: 'Nørreport' });
    expect(getFavorites().some(f => f.id === 'gym')).toBe(true);

    deleteFavorite('gym');
    expect(getFavorites().some(f => f.id === 'gym')).toBe(false);
  });
});
