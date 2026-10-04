import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Check, MapPin } from 'lucide-react';
import { getFavorites, saveFavorite, deleteFavorite } from '../services/storage';
import { fetchLocation } from '../services/api';
import GoogleMapsLocationIcon from './GoogleMapsLocationIcon';
import './EditFavoriteModal.css';

const ICON_OPTIONS = ['🏠', '💼', '🏋️', '🎓', '✈️', '🛒', '☕', '❤️', '⭐'];

export default function EditFavoriteModal({ isOpen, onClose, onFavoritesChanged }) {
  const [favorites, setFavorites] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editIcon, setEditIcon] = useState('🏠');
  const [editStation, setEditStation] = useState('');
  const [stationSuggestions, setStationSuggestions] = useState([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFavorites(getFavorites());
      setEditingId(null);
      setIsAddingNew(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!editStation || editStation.length < 2) {
      setStationSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetchLocation(editStation);
        const stops = res.LocationList?.StopLocation;
        const coords = res.LocationList?.CoordLocation;
        const list = [].concat(stops || []).concat(coords || []);
        setStationSuggestions(list.slice(0, 5));
      } catch (err) {
        setStationSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [editStation]);

  if (!isOpen) return null;

  const handleStartEdit = (fav) => {
    setEditingId(fav.id);
    setEditLabel(fav.label);
    setEditIcon(fav.icon);
    setEditStation(fav.station || '');
    setIsAddingNew(false);
  };

  const handleStartAddNew = () => {
    const id = `place_${Date.now()}`;
    setEditingId(id);
    setEditLabel('');
    setEditIcon('⭐');
    setEditStation('');
    setIsAddingNew(true);
  };

  const handleLocateCurrentStation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const coordX = Math.round(longitude * 1000000);
        const coordY = Math.round(latitude * 1000000);
        
        const baseUrl = './api';
        const apiKey = import.meta.env.VITE_API_KEY || '';
        const url = `${baseUrl}/stopsNearby?coordX=${coordX}&coordY=${coordY}&format=json${apiKey ? `&apikey=${apiKey}` : ''}`;
        
        const res = await fetch(url).then(r => r.json());
        const stops = res.LocationList?.StopLocation;
        if (stops && stops.length > 0) {
          const nearest = Array.isArray(stops) ? stops[0] : stops;
          setEditStation(nearest.name);
          setStationSuggestions([]);
        } else {
          alert("No nearby stops found");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to find location");
      } finally {
        setLocating(false);
      }
    }, (err) => {
      console.error(err);
      alert("Could not access your location");
      setLocating(false);
    });
  };

  const handleSave = () => {
    if (!editLabel.trim()) return;
    const updated = saveFavorite({
      id: editingId,
      label: editLabel.trim(),
      icon: editIcon,
      station: editStation.trim()
    });
    setFavorites(updated);
    setEditingId(null);
    setIsAddingNew(false);
    if (onFavoritesChanged) onFavoritesChanged(updated);
  };

  const handleDelete = (id) => {
    const updated = deleteFavorite(id);
    setFavorites(updated);
    if (editingId === id) {
      setEditingId(null);
      setIsAddingNew(false);
    }
    if (onFavoritesChanged) onFavoritesChanged(updated);
  };

  return (
    <div className="fav-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="fav-modal-title">
      <div className="fav-modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="fav-modal-header">
          <div className="fav-modal-title-wrap">
            <span className="fav-modal-badge">⭐</span>
            <h2 id="fav-modal-title">Favorite Places</h2>
          </div>
          <button type="button" className="fav-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </header>

        <p className="fav-modal-desc">
          Save your frequent destinations to fill them with a single tap.
        </p>

        <div className="fav-places-list">
          {favorites.map((fav) => {
            const isEditing = editingId === fav.id;

            if (isEditing) {
              return (
                <div key={fav.id} className="fav-edit-card">
                  <div className="fav-edit-top">
                    <div className="fav-icon-picker">
                      {ICON_OPTIONS.map((ico) => (
                        <button
                          key={ico}
                          type="button"
                          className={`icon-option-btn ${editIcon === ico ? 'selected' : ''}`}
                          onClick={() => setEditIcon(ico)}
                        >
                          {ico}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="fav-edit-inputs">
                    <input
                      type="text"
                      className="fav-input"
                      placeholder="Place Name (e.g. Home, Work)"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      disabled={fav.id === 'home' || fav.id === 'work'}
                    />
                    
                    <div className="fav-station-input-wrap">
                      <div className="fav-station-row-flex">
                        <input
                          type="text"
                          className="fav-input"
                          placeholder="Station / Address (e.g. Nørreport)"
                          value={editStation}
                          onChange={(e) => setEditStation(e.target.value)}
                          autoFocus
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="gmaps-location-btn fav-gps-btn"
                          onClick={handleLocateCurrentStation}
                          title="Use current location"
                          aria-label="Use current location"
                          disabled={locating}
                        >
                          <GoogleMapsLocationIcon loading={locating} size={18} color="#1A73E8" />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="fav-use-curr-action"
                        onClick={handleLocateCurrentStation}
                        disabled={locating}
                      >
                        <GoogleMapsLocationIcon loading={locating} size={14} color="#1A73E8" />
                        <span>{locating ? 'Locating nearest station...' : 'Use current location'}</span>
                      </button>
                      {stationSuggestions.length > 0 && (
                        <ul className="fav-suggestions-list">
                          {stationSuggestions.map((s, idx) => (
                            <li
                              key={idx}
                              className="fav-suggestion-item"
                              onClick={() => {
                                setEditStation(s.name);
                                setStationSuggestions([]);
                              }}
                            >
                              <MapPin size={14} />
                              <span>{s.name}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="fav-edit-actions">
                    <button type="button" className="fav-save-btn" onClick={handleSave}>
                      <Check size={16} /> Save
                    </button>
                    <button type="button" className="fav-cancel-btn" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                    {fav.id !== 'home' && fav.id !== 'work' && (
                      <button type="button" className="fav-delete-btn" onClick={() => handleDelete(fav.id)} title="Delete place">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={fav.id} className="fav-place-row">
                <div className="fav-place-info" onClick={() => handleStartEdit(fav)}>
                  <span className="fav-row-icon">{fav.icon}</span>
                  <div className="fav-row-text">
                    <span className="fav-row-label">{fav.label}</span>
                    <span className="fav-row-station">
                      {fav.station ? fav.station : <em className="station-unset">Tap to set station</em>}
                    </span>
                  </div>
                </div>
                <div className="fav-row-actions">
                  <button type="button" className="fav-edit-action-btn" onClick={() => handleStartEdit(fav)}>
                    Edit
                  </button>
                  {fav.id !== 'home' && fav.id !== 'work' && (
                    <button type="button" className="fav-delete-icon-btn" onClick={() => handleDelete(fav.id)} aria-label="Delete">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {isAddingNew && (
            <div className="fav-edit-card">
              <div className="fav-edit-top">
                <div className="fav-icon-picker">
                  {ICON_OPTIONS.map((ico) => (
                    <button
                      key={ico}
                      type="button"
                      className={`icon-option-btn ${editIcon === ico ? 'selected' : ''}`}
                      onClick={() => setEditIcon(ico)}
                    >
                      {ico}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fav-edit-inputs">
                <input
                  type="text"
                  className="fav-input"
                  placeholder="Place Name (e.g. Gym, Library)"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  autoFocus
                />
                
                <div className="fav-station-input-wrap">
                  <div className="fav-station-row-flex">
                    <input
                      type="text"
                      className="fav-input"
                      placeholder="Station (e.g. Kongens Nytorv)"
                      value={editStation}
                      onChange={(e) => setEditStation(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="gmaps-location-btn fav-gps-btn"
                      onClick={handleLocateCurrentStation}
                      title="Use current location"
                      aria-label="Use current location"
                      disabled={locating}
                    >
                      <GoogleMapsLocationIcon loading={locating} size={18} color="#1A73E8" />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="fav-use-curr-action"
                    onClick={handleLocateCurrentStation}
                    disabled={locating}
                  >
                    <GoogleMapsLocationIcon loading={locating} size={14} color="#1A73E8" />
                    <span>{locating ? 'Locating nearest station...' : 'Use current location'}</span>
                  </button>
                  {stationSuggestions.length > 0 && (
                    <ul className="fav-suggestions-list">
                      {stationSuggestions.map((s, idx) => (
                        <li
                          key={idx}
                          className="fav-suggestion-item"
                          onClick={() => {
                            setEditStation(s.name);
                            setStationSuggestions([]);
                          }}
                        >
                          <MapPin size={14} />
                          <span>{s.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="fav-edit-actions">
                <button type="button" className="fav-save-btn" onClick={handleSave}>
                  <Check size={16} /> Save Place
                </button>
                <button type="button" className="fav-cancel-btn" onClick={() => setIsAddingNew(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {!isAddingNew && !editingId && (
          <button type="button" className="fav-add-new-btn" onClick={handleStartAddNew}>
            <Plus size={16} /> Add Custom Place
          </button>
        )}
      </div>
    </div>
  );
}
