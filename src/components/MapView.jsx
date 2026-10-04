import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { fetchLocation } from '../services/api';
import { getTransportStyle } from '../utils/transportStyles';

// Fix Leaflet's default icon path issue with React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function MapView({ legs, fromLoc, toLoc }) {
  const [segments, setSegments] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadIntermediateStops() {
      if (!legs || legs.length === 0) {
        setLoading(false);
        return;
      }
      
      const parseCoord = (loc) => {
        if (!loc || !loc.x || !loc.y) return null;
        return [parseInt(loc.y) / 1000000, parseInt(loc.x) / 1000000]; // [lat, lng]
      };

      try {
        const loadedSegments = [];
        const coordCache = { 
          [fromLoc.name]: parseCoord(fromLoc), 
          [toLoc.name]: parseCoord(toLoc) 
        };

        const fetchCoord = async (name) => {
          if (coordCache[name]) return coordCache[name];
          const locRes = await fetchLocation(name);
          const st = locRes.LocationList?.StopLocation;
          const co = locRes.LocationList?.CoordLocation;
          const stops = [].concat(st || []).concat(co || []);
          const pos = parseCoord(stops[0]);
          if (pos) coordCache[name] = pos;
          return pos;
        };

        for (const leg of legs) {
          const startPos = await fetchCoord(leg.Origin.name);
          const endPos = await fetchCoord(leg.Destination.name);
          if (startPos && endPos) {
             loadedSegments.push({
               positions: [startPos, endPos],
               type: leg.type,
               name: leg.name
             });
          }
        }
        
        // Extract unique markers for rendering
        const uniqueMarkers = [];
        const seen = new Set();
        Object.entries(coordCache).forEach(([name, pos]) => {
          if (pos && !seen.has(name)) {
            seen.add(name);
            uniqueMarkers.push({ name, pos });
          }
        });
        
        setSegments(loadedSegments);
        setMarkers(uniqueMarkers);
      } catch (err) {
        console.error("Failed to load map path", err);
      } finally {
        setLoading(false);
      }
    }

    loadIntermediateStops();
  }, [legs, fromLoc, toLoc]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading map route...</div>;
  if (segments.length === 0) return <div style={{ padding: '2rem', background: '#eee', textAlign: 'center' }}>Map coordinates unavailable for this route.</div>;

  const latLngs = markers.map(m => m.pos);
  const bounds = L.latLngBounds(latLngs);

  const getStyleForType = (type, name) => {
    if (type === 'WALK') return { color: '#888', dashArray: '5, 8', weight: 4 };
    const { background } = getTransportStyle(type, name);
    return { color: background, dashArray: null, weight: 5 };
  };

  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <MapContainer bounds={bounds} boundsOptions={{ padding: [50, 50] }} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m, idx) => (
          <Marker key={idx} position={m.pos}>
            <Popup><strong>{m.name}</strong></Popup>
          </Marker>
        ))}
        {segments.map((seg, idx) => {
          const style = getStyleForType(seg.type, seg.name);
          return (
            <Polyline 
              key={idx} 
              positions={seg.positions} 
              color={style.color} 
              weight={style.weight} 
              dashArray={style.dashArray} 
            >
              <Popup><strong>{seg.name}</strong></Popup>
            </Polyline>
          );
        })}
      </MapContainer>
    </div>
  );
}
