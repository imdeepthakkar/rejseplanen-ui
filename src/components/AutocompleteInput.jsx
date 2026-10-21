import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { fetchLocation } from '../services/api';
import { getFavorites } from '../services/storage';
import GoogleMapsLocationIcon from './GoogleMapsLocationIcon';
import './AutocompleteInput.css';

export default function AutocompleteInput({ value, onChange, onSelect, placeholder, required }) {
  const [suggestions, setSuggestions] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputFocus = () => {
    const favs = getFavorites().filter(f => f.station && f.station.trim().length > 0);
    setFavorites(favs);
    if (!value || value.length < 2) {
      if (favs.length > 0) setIsOpen(true);
    } else {
      setIsOpen(true);
    }
    // Auto-select text on focus so any typing replaces pre-filled address immediately
    if (value && value.length > 0) {
      setTimeout(() => {
        inputRef.current?.select();
      }, 0);
    }
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
    setSuggestions([]);
    const favs = getFavorites().filter(f => f.station && f.station.trim().length > 0);
    setFavorites(favs);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (!value || value.length < 2) {
      setSuggestions([]);
      return;
    }
    
    // Only search if the dropdown is open (i.e. user is typing, not after they select)
    if (!isOpen) return;

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetchLocation(value);
        const st = res.LocationList?.StopLocation;
        const co = res.LocationList?.CoordLocation;
        const stops = [];
        if (st) stops.push(...(Array.isArray(st) ? st : [st]));
        if (co) stops.push(...(Array.isArray(co) ? co : [co]));
        
        setSuggestions(stops);
      } catch (err) {
        console.error('Failed to fetch suggestions', err);
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300); // debounce 300ms

    return () => clearTimeout(timeoutId);
  }, [value, isOpen]);

  const handleSelect = (suggestion) => {
    onChange(suggestion.name);
    setIsOpen(false);
    inputRef.current?.blur();
    onSelect?.(suggestion.name);
  };

  const handleInputChange = (e) => {
    onChange(e.target.value);
    setIsOpen(true);
  };

  const handleLocationClick = () => {
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
          const stopName = stops[0].name;
          onChange(stopName);
          setIsOpen(false);
          inputRef.current?.blur();
          onSelect?.(stopName);
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

  const showFavorites = (!value || value.length < 2) && favorites.length > 0;
  const showSuggestions = (value && value.length >= 2) && (suggestions.length > 0 || searching);

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <div className="autocomplete-row">
        <div className="autocomplete-input-box">
          <input
            ref={inputRef}
            type="text"
            className="input-field autocomplete-input"
            placeholder={placeholder}
            value={value}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            required={required}
          />
          {Boolean(value && value.length > 0) && (
            <button 
              type="button" 
              className="autocomplete-clear-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              title="Clear input"
              aria-label="Clear location input"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
        <button 
          type="button" 
          className="gmaps-location-btn"
          onClick={handleLocationClick} 
          title="Use my current location"
          aria-label="Use my current location"
          disabled={locating}
        >
          <GoogleMapsLocationIcon loading={locating} size={20} color="#1A73E8" />
        </button>
      </div>
      {isOpen && (showFavorites || showSuggestions) && (
        <ul className="suggestions-list">
          {showFavorites && (
            <>
              <li className="suggestion-header">⭐ Saved Places</li>
              {favorites.map((fav) => (
                <li
                  key={fav.id}
                  className="suggestion-item fav-suggestion-row"
                  onClick={() => {
                    onChange(fav.station);
                    setIsOpen(false);
                    inputRef.current?.blur();
                    onSelect?.(fav.station);
                  }}
                >
                  <span className="fav-row-icon-small">{fav.icon}</span>
                  <div className="fav-row-col">
                    <span className="fav-row-col-label">{fav.label}</span>
                    <span className="fav-row-col-station">{fav.station}</span>
                  </div>
                </li>
              ))}
            </>
          )}

          {showSuggestions && (
            searching ? (
              <li className="suggestion-item loading">Loading stations...</li>
            ) : (
              suggestions.slice(0, 8).map((s, i) => (
                <li 
                  key={i} 
                  className="suggestion-item" 
                  onClick={() => handleSelect(s)}
                >
                  {s.name}
                </li>
              ))
            )
          )}
        </ul>
      )}
    </div>
  );
}
