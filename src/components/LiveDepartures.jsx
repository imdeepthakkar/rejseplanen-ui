import React, { useState, useEffect, useMemo } from 'react';
import { fetchLocation, fetchDepartures, fetchStopsNearby } from '../services/api';
import { getFavorites } from '../services/storage';
import { getTransportStyle, formatLineBadge } from '../utils/transportStyles';
import { classifyDeparture, TRANSPORT_MODES } from '../utils/transportModes';
import { getLiveCountdown } from '../utils/countdownHelpers';
import { compareDeparturesChronological, getDateTimeTimestamp } from '../utils/timeHelpers';
import { motion, AnimatePresence } from 'framer-motion';
import AutocompleteInput from './AutocompleteInput';
import FavoriteChips from './FavoriteChips';
import ModeFilterBar from './ModeFilterBar';
import './FormStyles.css';

function getDepartureKey(d) {
  return `${d.date || ''}_${d.time}_${d.name}_${d.direction}_${d.track || d.rtTrack || ''}`;
}

export default function LiveDepartures() {
  const [station, setStation] = useState('');
  const [departures, setDepartures] = useState(null);
  const [resolvedStop, setResolvedStop] = useState(null);
  const [resolvedStopId, setResolvedStopId] = useState(null);
  const [resolvedStopIds, setResolvedStopIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [homeStation, setHomeStation] = useState('');
  const [selectedMode, setSelectedMode] = useState('ALL');
  const [now, setNow] = useState(() => new Date());

  // Auto-tick live countdowns every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const favs = getFavorites();
    const home = favs.find(f => f.id === 'home');
    const homeAddr = home?.station?.trim();
    if (homeAddr) {
      setStation(homeAddr);
      setHomeStation(homeAddr);
      loadDepartures(homeAddr);
    } else {
      setHomeStation('');
    }
  }, []);

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

      // Find associated sibling stops for major hubs (Metro / Letbane)
      const baseClean = targetStop.name.replace(/\s*\((Metro|Letbane|togbus|bus|Lokalbane)\)/i, '').trim().toLowerCase();
      const linked = stopList.filter(s => {
        if (!s.id || s.id === targetStop.id) return false;
        const sClean = s.name.replace(/\s*\((Metro|Letbane|togbus|bus|Lokalbane)\)/i, '').trim().toLowerCase();
        return sClean === baseClean && (
          s.name.toLowerCase().includes('(metro)') ||
          s.name.toLowerCase().includes('(letbane)')
        );
      });

      const allStopIds = [targetStop.id, ...linked.map(s => s.id)];
      setResolvedStopId(targetStop.id);
      setResolvedStopIds(allStopIds);

      // 2. Get departures window covering at least 30 minutes across all hub stops
      const deps = await fetchDeparturesWindow(allStopIds, [], 30, 3);
      setDepartures(deps);
    } catch (err) {
      setError(err.message || 'Failed to fetch departures');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeparturesWindow = async (stopIds, startDeps = [], minSpanMinutes = 30, maxBatches = 3) => {
    const ids = Array.isArray(stopIds) ? stopIds : [stopIds];
    let combined = [...startDeps];
    let seen = new Set(combined.map(getDepartureKey));
    let batches = 0;

    const initialLastDep = combined.length > 0 ? combined[combined.length - 1] : null;
    let nextTime = initialLastDep?.time;
    let nextDate = initialLastDep?.date;

    while (batches < maxBatches) {
      batches++;
      const depResults = await Promise.all(
        ids.map(id => fetchDepartures(id, nextTime, nextDate).catch(err => {
          console.warn('Failed to fetch from stop ' + id, err);
          return { DepartureBoard: { Departure: [] } };
        }))
      );

      let newItemsAdded = 0;
      for (const depRes of depResults) {
        const rawDeps = depRes?.DepartureBoard?.Departure || [];
        const batchDeps = Array.isArray(rawDeps) ? rawDeps : [rawDeps];
        for (const d of batchDeps) {
          const key = getDepartureKey(d);
          if (!seen.has(key)) {
            seen.add(key);
            combined.push(d);
            newItemsAdded++;
          }
        }
      }

      if (newItemsAdded === 0) break;

      // Sort combined chronologically by date and time
      const currentTime = new Date();
      combined.sort((a, b) => compareDeparturesChronological(a, b, currentTime));

      const firstDep = combined[0];
      const currentLastDep = combined[combined.length - 1];
      if (firstDep && currentLastDep) {
        const spanMs = getDateTimeTimestamp(currentLastDep.time, currentLastDep.date, currentTime) -
                       getDateTimeTimestamp(firstDep.time, firstDep.date, currentTime);
        const spanMinutes = spanMs / (60 * 1000);
        if (spanMinutes >= minSpanMinutes) {
          break;
        }
      }

      nextTime = currentLastDep?.time;
      nextDate = currentLastDep?.date;
    }

    return combined;
  };

  const handleLoadLater = async () => {
    const ids = resolvedStopIds.length > 0 ? resolvedStopIds : (resolvedStopId ? [resolvedStopId] : []);
    if (ids.length === 0 || !departures || departures.length === 0 || loadingMore) return;
    setLoadingMore(true);
    try {
      const more = await fetchDeparturesWindow(ids, departures, 30, 3);
      setDepartures(more);
    } catch (err) {
      console.error('Failed to load more departures', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    loadDepartures(station);
  };

  const handleSelectStation = (selectedStation) => {
    setStation(selectedStation);
    loadDepartures(selectedStation);
  };

  const handleSelectFavorite = (selectedStation) => {
    setStation(selectedStation);
    loadDepartures(selectedStation);
  };

  const handleFavoritesChanged = (updatedFavs) => {
    const home = updatedFavs.find(f => f.id === 'home');
    const homeAddr = home?.station?.trim() || '';
    setHomeStation(homeAddr);
    if (homeAddr && (!station || !departures)) {
      setStation(homeAddr);
      loadDepartures(homeAddr);
    }
  };

  // Filter departures according to selectedMode
  const filteredDepartures = useMemo(() => {
    if (!departures) return [];
    if (selectedMode === 'ALL') return departures;
    return departures.filter(d => classifyDeparture(d) === selectedMode);
  }, [departures, selectedMode]);

  return (
    <div>
      <form onSubmit={handleSubmit} className="form-group">
        <AutocompleteInput
          placeholder="Station or address (e.g., Nørreport)" 
          value={station} 
          onChange={setStation} 
          onSelect={handleSelectStation}
          required={true}
        />
        <FavoriteChips 
          onSelect={handleSelectFavorite}
          isModalOpen={isModalOpen}
          setIsModalOpen={setIsModalOpen}
          onFavoritesChanged={handleFavoritesChanged}
        />
        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Loading...' : 'Show Departures'}
        </button>
      </form>
      
      {!homeStation && !departures && !loading && !error && (
        <div className="home-setup-banner">
          <div className="home-setup-content">
            <span className="home-setup-icon">🏠</span>
            <div className="home-setup-text">
              <span className="home-setup-title">No Home station set</span>
              <span className="home-setup-desc">
                Configure your home address to see live departures automatically as soon as you open the app.
              </span>
            </div>
          </div>
          <button
            type="button"
            className="home-setup-action-btn"
            onClick={() => setIsModalOpen(true)}
          >
            Set Home Address
          </button>
        </div>
      )}

      {error && <div style={{ color: 'red', padding: '1rem' }}>{error}</div>}
      
      {departures && (
        <div style={{ padding: '0 4px 16px' }}>
          <div style={{ marginBottom: '12px' }}>
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

          {/* Mode Filter Bar */}
          <ModeFilterBar
            selectedMode={selectedMode}
            onSelectMode={setSelectedMode}
          />

          {departures.length === 0 ? (
            <p>No departures found.</p>
          ) : filteredDepartures.length === 0 ? (
            <div className="dep-empty-mode">
              <span className="dep-empty-text">
                No <strong>{TRANSPORT_MODES[selectedMode]?.label || selectedMode}</strong> departures found in the next 30 min.
              </span>
              <button
                type="button"
                className="pagination-btn"
                style={{ maxWidth: '240px' }}
                onClick={handleLoadLater}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading later departures...' : 'Search Later Departures (+30 min) ↓'}
              </button>
            </div>
          ) : (
            <>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <AnimatePresence>
                  {filteredDepartures.map((d, i) => {
                    const countdown = getLiveCountdown(d.time, d.rtTime, now, d.date, d.rtDate);
                    const style = getTransportStyle(d.type, d.name);
                    const badgeText = formatLineBadge(d.name);
                    const trackText = d.rtTrack || d.track;
                    const trackChanged = Boolean(d.rtTrack && d.track && d.rtTrack !== d.track);
                    const isDelayed = Boolean(d.rtTime && d.rtTime !== d.time);

                    return (
                      <motion.li 
                        key={getDepartureKey(d) + '_' + i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2, delay: Math.min(i * 0.025, 0.25) }}
                        className="departure-card"
                      >
                        <div className="dep-card-content">
                          {/* Left: What & Where */}
                          <div className="dep-card-left">
                            <span
                              className="dep-line-badge"
                              style={{
                                background: style.background,
                                color: style.color,
                              }}
                            >
                              {badgeText}
                            </span>
                            <div className="dep-dest-wrap">
                              <div className="dep-direction">
                                <span className="dep-arrow" aria-hidden="true">→</span>
                                <div className="dep-dest-text-group">
                                  <span className="dep-dest-name">{d.direction}</span>
                                  {d.cancelled === 'true' ? (
                                    <span className="dep-status-line cancelled">
                                      (Aflyst / Cancelled)
                                    </span>
                                  ) : isDelayed ? (
                                    <span className="dep-status-line delayed">
                                      (Expected: {d.rtTime})
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right: When & Platform */}
                          <div className="dep-card-right">
                            <span 
                              className={`countdown-badge ${countdown.isImminent ? 'is-imminent' : countdown.isDelayed ? 'is-delayed' : 'is-normal'}`}
                            >
                              {countdown.text}
                            </span>
                            <div className="dep-time-row">
                              <span className="dep-clock-time">{d.time}</span>
                              {trackText && (
                                <span className={`dep-track ${trackChanged ? 'is-changed' : ''}`}>
                                  Spor {trackText}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
              {filteredDepartures.length > 0 && (
                <div className="pagination-bar">
                  <div className="pagination-info">
                    <span>
                      Showing {filteredDepartures.length} of {departures.length} departures
                    </span>
                    <span className="pagination-range">
                      ({filteredDepartures[0].time} – {filteredDepartures[filteredDepartures.length - 1].time})
                    </span>
                  </div>
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={handleLoadLater}
                    disabled={loadingMore}
                  >
                    {loadingMore ? 'Loading later departures...' : 'Later Departures (+30 min) ↓'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
