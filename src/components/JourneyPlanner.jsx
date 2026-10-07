import React, { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { fetchLocation, fetchJourney } from '../services/api';
import { getTransportStyle } from '../utils/transportStyles';
import { timeToMinutes, timeDifferenceMinutes } from '../utils/timeHelpers';
import { motion, AnimatePresence } from 'framer-motion';
import AutocompleteInput from './AutocompleteInput';
import FavoriteChips from './FavoriteChips';
import MapView from './MapView';
import './FormStyles.css';

function getTripDepartureTime(trip) {
  const legs = Array.isArray(trip.Leg) ? trip.Leg : [trip.Leg];
  return legs[0]?.Origin?.time || '';
}

function getTripKey(trip) {
  const legs = Array.isArray(trip.Leg) ? trip.Leg : [trip.Leg];
  return legs.map(l => `${l.name || l.type}_${l.Origin?.name}_${l.Origin?.time}_${l.Destination?.name}_${l.Destination?.time}`).join('->');
}

export default function JourneyPlanner() {
  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const defaultTime = now.toTimeString().slice(0, 5);  // HH:MM

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [swapRotated, setSwapRotated] = useState(false);
  const [lastFocusedField, setLastFocusedField] = useState('from');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [journeys, setJourneys] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingLater, setLoadingLater] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [error, setError] = useState('');
  const [expandedJourney, setExpandedJourney] = useState(null);
  
  // Store the actual location objects for the map
  const [searchedFromLoc, setSearchedFromLoc] = useState(null);
  const [searchedToLoc, setSearchedToLoc] = useState(null);
  const [showMapForJourney, setShowMapForJourney] = useState(null);

  const handleSwap = (e) => {
    e.preventDefault();
    setFrom(to);
    setTo(from);
    setSwapRotated(prev => !prev);
    if (searchedFromLoc || searchedToLoc) {
      setSearchedFromLoc(searchedToLoc);
      setSearchedToLoc(searchedFromLoc);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setJourneys(null);
    setExpandedJourney(null);
    setShowMapForJourney(null);
    try {
      // 1. Get from station/coord
      const fromLocRes = await fetchLocation(from);
      const fromSt = fromLocRes.LocationList?.StopLocation;
      const fromCo = fromLocRes.LocationList?.CoordLocation;
      const fromStops = [];
      if (fromSt) fromStops.push(...(Array.isArray(fromSt) ? fromSt : [fromSt]));
      if (fromCo) fromStops.push(...(Array.isArray(fromCo) ? fromCo : [fromCo]));
      const fromLoc = fromStops.find(s => s.name === from) || fromStops[0];
      if (!fromLoc) throw new Error(`Could not find location: ${from}`);

      // 2. Get to station/coord
      const toLocRes = await fetchLocation(to);
      const toSt = toLocRes.LocationList?.StopLocation;
      const toCo = toLocRes.LocationList?.CoordLocation;
      const toStops = [];
      if (toSt) toStops.push(...(Array.isArray(toSt) ? toSt : [toSt]));
      if (toCo) toStops.push(...(Array.isArray(toCo) ? toCo : [toCo]));
      const toLoc = toStops.find(s => s.name === to) || toStops[0];
      if (!toLoc) throw new Error(`Could not find location: ${to}`);

      setSearchedFromLoc(fromLoc);
      setSearchedToLoc(toLoc);

      // 3. Get journeys covering at least 30 minutes
      const parsedTrips = await fetchJourneysWindow(fromLoc, toLoc, date, time, 30, 2);
      setJourneys(parsedTrips);
    } catch (err) {
      setError(err.message || 'Failed to fetch journey');
    } finally {
      setLoading(false);
    }
  };

  const fetchJourneysWindow = async (fromLocation, toLocation, searchDate, initialTime, minSpanMinutes = 30, maxBatches = 2) => {
    let combined = [];
    let seen = new Set();
    let currentTime = initialTime;
    let batches = 0;

    while (batches < maxBatches) {
      batches++;
      // Fetch both standard routing and non-metro routing in parallel to uncover all route options (e.g. regional trains, S-trains, Metro)
      const [stdRes, noMetroRes] = await Promise.all([
        fetchJourney(fromLocation, toLocation, searchDate, currentTime).catch(() => ({})),
        fetchJourney(fromLocation, toLocation, searchDate, currentTime, { useMetro: false }).catch(() => ({}))
      ]);

      const rawStd = stdRes.TripList?.Trip || [];
      const rawNoMetro = noMetroRes.TripList?.Trip || [];
      const batchTrips = [
        ...(Array.isArray(rawStd) ? rawStd : [rawStd]),
        ...(Array.isArray(rawNoMetro) ? rawNoMetro : [rawNoMetro])
      ];

      if (batchTrips.length === 0) break;

      let newItemsAdded = 0;
      for (const t of batchTrips) {
        if (!t || !t.Leg) continue;
        const key = getTripKey(t);
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(t);
          newItemsAdded++;
        }
      }

      if (newItemsAdded === 0) break;

      combined.sort((a, b) => timeToMinutes(getTripDepartureTime(a)) - timeToMinutes(getTripDepartureTime(b)));

      const firstTime = getTripDepartureTime(combined[0]);
      const lastTime = getTripDepartureTime(combined[combined.length - 1]);
      if (firstTime && lastTime && timeDifferenceMinutes(firstTime, lastTime) >= minSpanMinutes) {
        break;
      }

      currentTime = lastTime;
    }

    return combined;
  };

  const handleLoadLaterJourneys = async () => {
    if (!searchedFromLoc || !searchedToLoc || !journeys || journeys.length === 0 || loadingLater) return;
    setLoadingLater(true);
    try {
      const lastTrip = journeys[journeys.length - 1];
      const lastTime = getTripDepartureTime(lastTrip);

      // Fetch next 30 minutes with both standard and alternative options
      const moreTrips = await fetchJourneysWindow(searchedFromLoc, searchedToLoc, date, lastTime, 30, 2);

      let combined = [...journeys];
      let seen = new Set(combined.map(getTripKey));

      for (const t of moreTrips) {
        const key = getTripKey(t);
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(t);
        }
      }

      combined.sort((a, b) => timeToMinutes(getTripDepartureTime(a)) - timeToMinutes(getTripDepartureTime(b)));
      setJourneys(combined);
    } catch (err) {
      console.error('Failed to load later journeys', err);
    } finally {
      setLoadingLater(false);
    }
  };

  const handleLoadEarlierJourneys = async () => {
    if (!searchedFromLoc || !searchedToLoc || !journeys || journeys.length === 0 || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const firstTrip = journeys[0];
      const firstTime = getTripDepartureTime(firstTrip);
      let mins = timeToMinutes(firstTime) - 30;
      if (mins < 0) mins += 24 * 60;
      const hh = String(Math.floor(mins / 60)).padStart(2, '0');
      const mm = String(mins % 60).padStart(2, '0');
      const earlierTime = `${hh}:${mm}`;

      const earlierTrips = await fetchJourneysWindow(searchedFromLoc, searchedToLoc, date, earlierTime, 30, 2);

      let combined = [...earlierTrips, ...journeys];
      let seen = new Set();
      let deduped = [];
      for (const t of combined) {
        const key = getTripKey(t);
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(t);
        }
      }
      deduped.sort((a, b) => timeToMinutes(getTripDepartureTime(a)) - timeToMinutes(getTripDepartureTime(b)));
      setJourneys(deduped);
    } catch (err) {
      console.error('Failed to load earlier journeys', err);
    } finally {
      setLoadingEarlier(false);
    }
  };

  const handleSelectFavorite = (stationName) => {
    if (lastFocusedField === 'to') {
      setTo(stationName);
    } else {
      setFrom(stationName);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="form-group">
        <div onFocus={() => setLastFocusedField('from')}>
          <AutocompleteInput
            placeholder="From (e.g., Copenhagen Central)" 
            value={from} 
            onChange={setFrom} 
            required={true}
          />
        </div>

        <div className="swap-row">
          <motion.button 
            type="button" 
            className="swap-btn"
            onClick={handleSwap}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            title="Swap From and To"
            aria-label="Swap From and To locations"
          >
            <motion.div
              animate={{ rotate: swapRotated ? 180 : 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ArrowUpDown size={18} strokeWidth={2.2} />
            </motion.div>
          </motion.button>
        </div>

        <div onFocus={() => setLastFocusedField('to')}>
          <AutocompleteInput
            placeholder="To (e.g., Aarhus Central)" 
            value={to} 
            onChange={setTo} 
            required={true}
          />
        </div>
        <FavoriteChips onSelect={handleSelectFavorite} />
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)}
            style={{ flex: 1, padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input 
            type="time" 
            value={time} 
            onChange={e => setTime(e.target.value)}
            style={{ flex: 1, padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Searching...' : 'Search Journey'}
        </button>
      </form>

      {error && <div style={{ color: 'red', padding: '1rem' }}>{error}</div>}
      
      {journeys && (
        <div style={{ padding: '0 4px 16px' }}>
          <h3 style={{ margin: '0 0 12px', color: 'var(--ink)' }}>Journeys found</h3>
          {journeys.length === 0 ? (
            <p>No journeys found.</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  className="pagination-btn"
                  style={{ width: 'auto', padding: '6px 14px', fontSize: '13px' }}
                  onClick={handleLoadEarlierJourneys}
                  disabled={loadingEarlier}
                >
                  {loadingEarlier ? 'Loading earlier...' : '↑ Earlier Journeys (-30 min)'}
                </button>
                <span style={{ fontSize: '13px', color: 'var(--sub)', fontWeight: '600' }}>
                  {getTripDepartureTime(journeys[0])} – {getTripDepartureTime(journeys[journeys.length - 1])}
                </span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {journeys.map((trip, i) => {
                const legs = Array.isArray(trip.Leg) ? trip.Leg : [trip.Leg];
                const start = legs[0];
                const end = legs[legs.length - 1];
                const transportLegs = legs.filter(l => l.type !== 'WALK');
                const isExpanded = expandedJourney === i;
                const isMapVisible = showMapForJourney === i;
                
                // Helper to calculate duration and extract minutes
                const calculateJourneyStats = (startDateStr, startTimeStr, endDateStr, endTimeStr) => {
                  if (!startDateStr || !startTimeStr || !endDateStr || !endTimeStr) return { durationStr: 'N/A', totalMins: 0 };
                  try {
                    const parseDate = (d, t) => {
                      const [DD, MM, YY] = d.split('.');
                      const [HH, mm] = t.split(':');
                      return new Date(`20${YY}-${MM}-${DD}T${HH}:${mm}:00`);
                    };
                    const startDt = parseDate(startDateStr, startTimeStr);
                    const endDt = parseDate(endDateStr, endTimeStr);
                    const diffMs = endDt - startDt;
                    const totalMins = Math.round(diffMs / 60000);
                    return { totalMins };
                  } catch (e) {
                    return { totalMins: 0 };
                  }
                };
                
                const stats = calculateJourneyStats(start.Origin.date, start.Origin.time, end.Destination.date, end.Destination.time);
                
                return (
                  <motion.li 
                    layout
                    key={i} 
                    style={{ 
                      borderRadius: '16px', border: 'none', 
                      marginBottom: '16px', background: 'var(--cardSolid)',
                      overflow: 'hidden', transition: 'box-shadow 0.2s',
                      boxShadow: isExpanded ? '0 8px 30px rgba(0,0,0,0.1)' : '0 2px 10px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div 
                      onClick={() => { 
                        setExpandedJourney(isExpanded ? null : i);
                        if (!isExpanded) {
                          setShowMapForJourney(null);
                        }
                      }}
                      style={{ padding: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--ink)' }}>
                          {start.Origin.time}
                          {start.type !== 'WALK' && start.Origin.rtTime && start.Origin.rtTime !== start.Origin.time && (
                            <span style={{ color: '#e51937', fontSize: '0.9rem', marginLeft: '4px' }}>
                              ({start.Origin.rtTime})
                            </span>
                          )}
                          {' - Arrive at: '}
                          {end.Destination.time}
                          {end.type !== 'WALK' && end.Destination.rtTime && end.Destination.rtTime !== end.Destination.time && (
                            <span style={{ color: '#e51937', fontSize: '0.9rem', marginLeft: '4px' }}>
                              ({end.Destination.rtTime})
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.95rem', color: 'var(--sub)', display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                          <span><strong>Total:</strong> {stats.totalMins} min</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {transportLegs.map((leg, idx) => {
                          const isWalk = leg.type === 'WALK';
                          return (
                            <React.Fragment key={idx}>
                              {isWalk ? (
                                <span style={{ color: '#888', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  Walk
                                </span>
                              ) : (
                                <span style={{
                                  background: getTransportStyle(leg.type, leg.name).background,
                                  color: getTransportStyle(leg.type, leg.name).color,
                                  padding: '3px 7px',
                                  borderRadius: '5px',
                                  fontWeight: '700',
                                  fontSize: '13px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  {leg.name}
                                </span>
                              )}
                              {idx < transportLegs.length - 1 && <span style={{ color: '#ccc', margin: '0 2px' }}>•</span>}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                          style={{ borderTop: '1px solid var(--cardBorder)', background: '#FAFAFA', overflow: 'hidden' }}
                        >
                          <div style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                              <h4 style={{ margin: 0, color: 'var(--ink)' }}>Detailed steps for option {i + 1}</h4>
                              <button style={{
                                background: isMapVisible ? 'var(--cardBorder)' : 'var(--pop)', 
                                color: isMapVisible ? 'var(--ink)' : '#fff', 
                                border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                                fontWeight: '600'
                              }} onClick={(e) => { 
                                e.stopPropagation();
                                setShowMapForJourney(isMapVisible ? null : i);
                              }}>
                                {isMapVisible ? 'Hide Map' : 'Map view'}
                              </button>
                            </div>
                            
                            {isMapVisible && (
                              <div style={{ marginBottom: '1.5rem', height: '280px', borderRadius: '12px', overflow: 'hidden' }}>
                                <MapView legs={legs} fromLoc={searchedFromLoc} toLoc={searchedToLoc} />
                              </div>
                            )}
                        
                        {legs.map((leg, stepIdx) => {
                          const style = leg.type === 'WALK' 
                            ? { color: '#888' } 
                            : { color: getTransportStyle(leg.type, leg.name).background };
                          return (
                          <div key={stepIdx} style={{ position: 'relative', paddingLeft: '24px', paddingBottom: '24px' }}>
                            {/* Vertical Line */}
                            <div style={{ position: 'absolute', left: '7px', top: '12px', bottom: '-12px', width: '4px', background: style.color, borderRadius: '2px' }}></div>
                            {/* Dot */}
                            <div style={{ position: 'absolute', left: '4px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: '#fff', border: `3px solid ${style.color}`, zIndex: 2 }}></div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--ink)' }}>
                                  {leg.Origin.time} <span style={{ marginLeft: '8px' }}>{leg.Origin.name.split(',')[0]}</span>
                                  {leg.type !== 'WALK' && leg.Origin.rtTime && leg.Origin.rtTime !== leg.Origin.time && (
                                    <span style={{ color: '#e51937', marginLeft: '0.5rem', fontWeight: 'bold', fontSize: '13px' }}>
                                      (Expected: {leg.Origin.rtTime})
                                    </span>
                                  )}
                                </div>
                                <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--sub)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{
                                    background: style.color,
                                    color: '#fff',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: '700',
                                    fontSize: '12px'
                                  }}>{leg.type === 'WALK' ? 'Walk' : leg.name}</span>
                                  {leg.type === 'WALK' ? 'Walk to next stop' : `to ${leg.Destination.name.split(',')[0]}`}
                                </div>
                              </div>
                            </div>
                            
                            {/* Final Destination Dot for the last leg */}
                            {stepIdx === legs.length - 1 && (
                              <div style={{ position: 'absolute', left: '4px', bottom: '-12px', width: '10px', height: '10px', borderRadius: '50%', background: '#fff', border: `3px solid ${style.color}`, zIndex: 2 }}></div>
                            )}
                            {stepIdx === legs.length - 1 && (
                              <div style={{ marginTop: '24px', fontSize: '15px', fontWeight: '700', color: 'var(--ink)' }}>
                                {leg.Destination.time} <span style={{ marginLeft: '8px' }}>{leg.Destination.name.split(',')[0]}</span>
                                {leg.type !== 'WALK' && leg.Destination.rtTime && leg.Destination.rtTime !== leg.Destination.time && (
                                  <span style={{ color: '#e51937', marginLeft: '0.5rem', fontWeight: 'bold', fontSize: '13px' }}>
                                    (Expected: {leg.Destination.rtTime})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )})}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
            {journeys.length > 0 && (
              <div className="pagination-bar" style={{ marginTop: '14px' }}>
                <div className="pagination-info">
                  <span>Showing {journeys.length} journeys</span>
                  <span className="pagination-range">
                    ({getTripDepartureTime(journeys[0])} – {getTripDepartureTime(journeys[journeys.length - 1])})
                  </span>
                </div>
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={handleLoadLaterJourneys}
                  disabled={loadingLater}
                >
                  {loadingLater ? 'Loading later journeys...' : 'Later Journeys (+30 min) ↓'}
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
