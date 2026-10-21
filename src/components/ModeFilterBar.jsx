import React from 'react';
import { Bus, Train, TramFront, Layers } from 'lucide-react';
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
        <span className="re-train-icon-badge" aria-hidden="true">
          <Train size={12} />
          <span className="re-text">RE</span>
        </span>
      );
    case 'letbane':
      return <TramFront size={14} className="mode-icon" />;
    default:
      return null;
  }
}

export default function ModeFilterBar({ selectedMode, onSelectMode }) {
  return (
    <div className="mode-filter-container" role="toolbar" aria-label="Filter departures by transport mode">
      <div className="mode-filter-scroll">
        {MODE_KEYS.map((key) => {
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
