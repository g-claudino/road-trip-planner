import type { Favorite } from "../types";

interface Props {
  favorites: Favorite[];
  onLoad: (favorite: Favorite) => void;
  onRemove: (id: string) => void;
}

export function FavoritesPanel({ favorites, onLoad, onRemove }: Props) {
  return (
    <div className="sidebar-section favorites-panel">
      <h2>★ Favorites</h2>

      {favorites.length === 0 ? (
        <p className="border-hint">
          No favorite trips yet. Plan a route, then tap the star next to the trip summary to save
          it here for quick access next time.
        </p>
      ) : (
        <ul className="favorites-list">
          {favorites.map((fav) => (
            <li key={fav.id} className="favorite-item">
              <button className="favorite-load-btn" onClick={() => onLoad(fav)}>
                <span className="favorite-name">{fav.name}</span>
                <span className="favorite-meta">
                  {fav.roundTrip ? "Round trip" : "One way"} · every {fav.intervalKm} km
                </span>
              </button>
              <button
                className="favorite-remove-btn"
                onClick={() => onRemove(fav.id)}
                aria-label={`Remove ${fav.name} from favorites`}
                title="Remove favorite"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
