import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { getDefaultTab, setDefaultTab } from '../services/storage';
import './Tabs.css';

export default function Tabs({ activeTab, onTabChange }) {
  const [defaultTab, setLocalDefaultTab] = useState(() => getDefaultTab());

  const handleToggleDefault = (e, tabKey) => {
    e.stopPropagation();
    setDefaultTab(tabKey);
    setLocalDefaultTab(tabKey);
  };

  return (
    <div className="tabs-container" role="tablist">
      <div 
        className={`tab-item ${activeTab === 'journey' ? 'active' : ''}`}
        onClick={() => onTabChange('journey')}
        role="tab"
        aria-selected={activeTab === 'journey'}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onTabChange('journey'); }}
      >
        <span className="tab-label">Journey Planner</span>
        <button
          type="button"
          className={`tab-default-pin ${defaultTab === 'journey' ? 'is-default' : ''}`}
          onClick={(e) => handleToggleDefault(e, 'journey')}
          title={defaultTab === 'journey' ? 'Default launch tab' : 'Set as default launch tab'}
          aria-label={defaultTab === 'journey' ? 'Default launch tab' : 'Set as default launch tab'}
        >
          <Star 
            size={14} 
            fill={defaultTab === 'journey' ? '#F59E0B' : 'none'} 
            color={defaultTab === 'journey' ? '#F59E0B' : 'currentColor'} 
          />
        </button>
      </div>

      <div 
        className={`tab-item ${activeTab === 'departures' ? 'active' : ''}`}
        onClick={() => onTabChange('departures')}
        role="tab"
        aria-selected={activeTab === 'departures'}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onTabChange('departures'); }}
      >
        <span className="tab-label">Live Departures</span>
        <button
          type="button"
          className={`tab-default-pin ${defaultTab === 'departures' ? 'is-default' : ''}`}
          onClick={(e) => handleToggleDefault(e, 'departures')}
          title={defaultTab === 'departures' ? 'Default launch tab' : 'Set as default launch tab'}
          aria-label={defaultTab === 'departures' ? 'Default launch tab' : 'Set as default launch tab'}
        >
          <Star 
            size={14} 
            fill={defaultTab === 'departures' ? '#F59E0B' : 'none'} 
            color={defaultTab === 'departures' ? '#F59E0B' : 'currentColor'} 
          />
        </button>
      </div>
    </div>
  );
}
