import React, { useState } from 'react';
import { fetchLocation, fetchDepartures, fetchStopsNearby } from '../services/api';
import { getTransportStyle } from '../utils/transportStyles';
import { motion, AnimatePresence } from 'framer-motion';
import AutocompleteInput from './AutocompleteInput';
import FavoriteChips from './FavoriteChips';
import './FormStyles.css';

export default function LiveDepartures() {
  const [station, setStation] = useState('');
  const [departures, setDepartures] = useState(null);
  const [resolvedStop, setResolvedStop] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadDepartures = async (query) => {
    if (!query || !query.trim()) return;
    setLoading(true);
    setError('');
    setDepartures(null);
    setResolvedStop(null);

    try {
      // 1. Get location details (station or address)
      const locRes = await fetchLocation(query.trim());
      const st = locRes.LocationList?.StopLocation;
      const co = locRes.LocationList?.CoordLocation;

      const stopList = [];
      if (st) stopList.push(...(Array.isArray(st) ? st : [st]));

      const coordList = [];
      if (co) coordList.push(...(Array.isArray(co) ? co : [co]));

      if (stopList.length === 0 && coordList.length === 0) {
        throw new Error('Station not found');
      }

      let targetStop = null;
      let isNearby = false;
      let nearbyDistance = null;

      const normalizedQuery = query.trim().toLowerCase();
      const exactStop = stopList.find(s => s.name.toLowerCase() === normalizedQuery);
      const exactCoord = coordList.find(c => c.name.toLowerCase() === normalizedQuery);

      if (exactStop) {
        targetStop = exactStop;
      } else if (exactCoord) {
        // Matched an address (e.g. favorite home address)
        const nearbyRes = await fetchStopsNearby(exactCoord.x, exactCoord.y);
        const nearbyStops = nearbyRes.LocationList?.StopLocation;
        const parsed = nearbyStops ? (Array.isArray(nearbyStops) ? nearbyStops : [nearbyStops]) : [];
        if (parsed.length === 0) {
          throw new Error('No transit stations found near this address');
        }
        targetStop = parsed[0];
        isNearby = true;
        nearbyDistance = targetStop.distance;
      } else if (coordList.length > 0 && stopList.length === 0) {
        // Address only
        const targetCoord = coordList[0];
        const nearbyRes = await fetchStopsNearby(targetCoord.x, targetCoord.y);
        const nearbyStops = nearbyRes.LocationList?.StopLocation;
        const parsed = nearbyStops ? (Array.isArray(nearbyStops) ? nearbyStops : [nearbyStops]) : [];
        if (parsed.length === 0) {
          throw new Error('No transit stations found near this address');
        }
        targetStop = parsed[0];
        isNearby = true;
        nearbyDistance = targetStop.distance;
      } else if (stopList.length > 0 && coordList.length === 0) {
        targetStop = stopList[0];
      } else {
        // Both exist without exact match. If query contains street number, prioritize address coords
        const hasNumber = /\d+/.test(query);
        if (hasNumber && coordList.length > 0) {
          const targetCoord = coordList[0];
          const nearbyRes = await fetchStopsNearby(targetCoord.x, targetCoord.y);
          const nearbyStops = nearbyRes.LocationList?.StopLocation;
          const parsed = nearbyStops ? (Array.isArray(nearbyStops) ? nearbyStops : [nearbyStops]) : [];
          if (parsed.length > 0) {
            targetStop = parsed[0];
            isNearby = true;
            nearbyDistance = targetStop.distance;
          } else {
            targetStop = stopList[0];
          }
        } else {
          targetStop = stopList[0];
        }
      }

      if (!targetStop || !targetStop.id) {
        throw new Error('Station ID not available');
      }

      setResolvedStop({
        name: targetStop.name,
        distance: nearbyDistance,
        isNearby
      });

      // 2. Get departures
      const depRes = await fetchDepartures(targetStop.id);
      const deps = depRes.DepartureBoard?.Departure || [];
      setDepartures(Array.isArray(deps) ? deps : [deps]);
    } catch (err) {
      setError(err.message || 'Failed to fetch departures');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    loadDepartures(station);
  };

  const handleSelectFavorite = (selectedStation) => {
    setStation(selectedStation);
    loadDepartures(selectedStation);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="form-group">
        <AutocompleteInput
          placeholder="Station or address (e.g., Nørreport)" 
          value={station} 
          onChange={setStation} 
          required={true}
        />
        <FavoriteChips onSelect={handleSelectFavorite} />
        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Loading...' : 'Show Departures'}
        </button>
      </form>
      
      {error && <div style={{ color: 'red', padding: '1rem' }}>{error}</div>}
      
      {departures && (
        <div style={{ padding: '0 2rem 2rem' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: 'var(--ink)' }}>Live Departures</h3>
            {resolvedStop && (
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--sub)' }}>
                {resolvedStop.isNearby ? (
                  <>
                    Nearest stop: <strong style={{ color: 'var(--ink)' }}>{resolvedStop.name}</strong>
                    {resolvedStop.distance ? ` (${resolvedStop.distance}m away)` : ''}
                  </>
                ) : (
                  <>
                    Station: <strong style={{ color: 'var(--ink)' }}>{resolvedStop.name}</strong>
                  </>
                )}
              </p>
            )}
          </div>
          {departures.length === 0 ? (
            <p>No departures found.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <AnimatePresence>
                {departures.slice(0, 10).map((d, i) => (
                  <motion.li 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, delay: i * 0.05 }}
                    style={{ 
                      padding: '16px', borderBottom: '1px solid var(--cardBorder)', 
                      display: 'flex', alignItems: 'center', gap: '16px',
                      background: '#FFFFFF'
                    }}
                  >
                  <div style={{ width: '60px', fontWeight: '800', fontSize: '20px', color: 'var(--ink)' }}>
                    {d.time}
                  </div>
                  <div style={{
                    background: getTransportStyle(d.type, d.name).background,
                    color: getTransportStyle(d.type, d.name).color,
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontWeight: '800',
                    fontSize: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px'
                  }}>
                    {d.name}
                  </div>
                  <div style={{ flex: 1, fontSize: '16px', fontWeight: '700', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.direction.split(',')[0]}
                  </div>
                  {d.track && (
                    <div style={{ color: 'var(--sub)', fontSize: '14px', fontWeight: '600' }}>
                      Trk {d.track}
                    </div>
                  )}
                </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
