import React, { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { fetchLocation, fetchJourney } from '../services/api';
import { getTransportStyle } from '../utils/transportStyles';
import { motion, AnimatePresence } from 'framer-motion';
import AutocompleteInput from './AutocompleteInput';
import FavoriteChips from './FavoriteChips';
import MapView from './MapView';
import './FormStyles.css';

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

      // 3. Get journey
      const tripRes = await fetchJourney(fromLoc, toLoc, date, time);
      const trips = tripRes.TripList?.Trip || [];
      const parsedTrips = Array.isArray(trips) ? trips : [trips];
      setJourneys(parsedTrips);
    } catch (err) {
      setError(err.message || 'Failed to fetch journey');
    } finally {
      setLoading(false);
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
        <div style={{ padding: '0 2rem 2rem' }}>
          <h3 style={{ marginTop: 0 }}>Journeys found</h3>
          {journeys.length === 0 ? (
            <p>No journeys found.</p>
          ) : (
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
                      style={{ padding: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          {transportLegs.map((leg, idx) => {
                            const isWalk = leg.type === 'WALK';
                            return (
                              <React.Fragment key={idx}>
                                {isWalk ? (
                                  <span style={{ color: '#888', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 4v16M17 8l-4-4-4 4"/></svg>
                                    Walk
                                  </span>
                                ) : (
                                  <span style={{
                                    background: getTransportStyle(leg.type, leg.name).background,
                                    color: getTransportStyle(leg.type, leg.name).color,
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontWeight: '800',
                                    fontSize: '14px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: '32px'
                                  }}>
                                    {leg.name}
                                  </span>
                                )}
                                {idx < transportLegs.length - 1 && <span style={{ color: '#ccc', margin: '0 2px' }}>•</span>}
                              </React.Fragment>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--ink)' }}>
                          {start.Origin.time}
                          <span style={{ color: 'var(--soft)', fontWeight: '500', fontSize: '15px', marginLeft: '8px' }}>
                            {end.Destination.name.split(',')[0]}
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--sub)', marginTop: '4px' }}>
                          {start.Origin.time} - {end.Destination.time}
                        </div>
                      </div>
                      
                      <div style={{ textAlign: 'center', paddingLeft: '16px' }}>
                        <div style={{ fontSize: '36px', fontWeight: '800', color: 'var(--bg-dark)', lineHeight: '1' }}>
                          {stats.totalMins}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--bg-dark)' }}>
                          min
                        </div>
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
          )}
        </div>
      )}
    </div>
  );
}
