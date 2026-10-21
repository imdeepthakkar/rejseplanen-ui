import React from 'react';
import { Bus, TramFront, Layers } from 'lucide-react';
import { MODE_KEYS, TRANSPORT_MODES } from '../utils/transportModes';
import './ModeFilterBar.css';

function renderModeIcon(iconType) {
  switch (iconType) {
    case 'all':
      return <Layers size={14} className="mode-icon" />;
    case 'bus':
      return <Bus size={14} className="mode-icon" />;
    case 's-tog':
      return (
        <span className="s-tog-icon-badge" aria-hidden="true">
          S
        </span>
      );
    case 'metro-m':
      return (
        <span className="metro-m-icon" aria-hidden="true">
          M
        </span>
      );
    case 'train-re':
      return (
        <span className="re-clean-badge" aria-hidden="true">
          RE
        </span>
      );
    case 'letbane':
      return <TramFront size={14} className="mode-icon" />;
    default:
      return null;
  }
}

export default function ModeFilterBar({ selectedMode, onSelectMode, availableModes = MODE_KEYS }) {
  const visibleModes = availableModes && availableModes.length > 0 
    ? MODE_KEYS.filter(key => availableModes.includes(key))
    : MODE_KEYS;

  const countClass = `cols-${Math.min(visibleModes.length, 3)}`;

  return (
    <div className="mode-filter-container" role="toolbar" aria-label="Filter departures by transport mode">
      <div className={`mode-filter-scroll ${countClass}`}>
        {visibleModes.map((key) => {
          const config = TRANSPORT_MODES[key];
          const isSelected = selectedMode === key;

          return (
            <button
              key={key}
              type="button"
              className={`mode-filter-chip ${isSelected ? 'active' : ''} mode-${key.toLowerCase()}`}
              onClick={() => onSelectMode(key)}
              aria-pressed={isSelected}
              title={`Filter by ${config.label}`}
            >
              <span 
                className="mode-filter-icon-wrap" 
                style={{ background: config.background, color: config.color }}
              >
                {renderModeIcon(config.iconType)}
              </span>
              <span className="mode-filter-label">{config.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
