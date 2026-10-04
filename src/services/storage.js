const DEFAULT_TAB_KEY = 'rejseplanen_default_tab';
const FAVORITES_KEY = 'rejseplanen_favorites';

export const INITIAL_FAVORITES = [
  { id: 'home', label: 'Home', icon: '🏠', station: '' },
  { id: 'work', label: 'Work', icon: '💼', station: '' },
];

export function getDefaultTab() {
  try {
    const tab = localStorage.getItem(DEFAULT_TAB_KEY);
    return tab === 'departures' ? 'departures' : 'journey';
  } catch (err) {
    return 'journey';
  }
}

export function setDefaultTab(tab) {
  try {
    localStorage.setItem(DEFAULT_TAB_KEY, tab);
  } catch (err) {
    console.error('Failed to set default tab', err);
  }
}

export function getFavorites() {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (!stored) return INITIAL_FAVORITES;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_FAVORITES;
  } catch (err) {
    return INITIAL_FAVORITES;
  }
}

export function saveFavorite(place) {
  try {
    const current = getFavorites();
    const index = current.findIndex(f => f.id === place.id);
    let updated;
    if (index >= 0) {
      updated = [...current];
      updated[index] = { ...updated[index], ...place };
    } else {
      updated = [...current, place];
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save favorite', err);
    return getFavorites();
  }
}

export function deleteFavorite(id) {
  try {
    const current = getFavorites();
    const updated = current.filter(f => f.id !== id);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to delete favorite', err);
    return getFavorites();
  }
}
