import React, { useState, useEffect } from 'react';
import { Settings, Plus } from 'lucide-react';
import { getFavorites } from '../services/storage';
import EditFavoriteModal from './EditFavoriteModal';
import './FavoriteChips.css';

export default function FavoriteChips({ onSelect }) {
  const [favorites, setFavorites] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadFavorites = () => {
    setFavorites(getFavorites());
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  const handleChipClick = (fav) => {
    if (fav.station && fav.station.trim().length > 0) {
      onSelect(fav.station);
    } else {
      // Station not configured yet, open modal to configure it
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <div className="fav-chips-bar" aria-label="Favorite places shortcuts">
        <div className="fav-chips-scroll">
          {favorites.map((fav) => {
            const isSet = Boolean(fav.station && fav.station.trim());
            return (
              <button
                key={fav.id}
                type="button"
                className={`fav-chip-btn ${isSet ? 'is-set' : 'is-empty'}`}
                onClick={() => handleChipClick(fav)}
                title={isSet ? `Fill ${fav.station}` : `Configure ${fav.label}`}
              >
                <span className="fav-chip-icon">{fav.icon}</span>
                <span className="fav-chip-label">{fav.label}</span>
                {!isSet && <span className="fav-chip-badge">Setup</span>}
              </button>
            );
          })}

          <button
            type="button"
            className="fav-chip-manage-btn"
            onClick={() => setIsModalOpen(true)}
            title="Manage saved places"
            aria-label="Manage saved places"
          >
            <Settings size={13} />
            <span>Places</span>
          </button>
        </div>
      </div>

      <EditFavoriteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFavoritesChanged={(updated) => setFavorites(updated)}
      />
    </>
  );
}
