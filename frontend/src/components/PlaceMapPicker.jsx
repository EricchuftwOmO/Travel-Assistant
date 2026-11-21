import { useCallback, useEffect, useRef, useState } from 'react';
import { AdvancedMarker, APIProvider, Map } from '@vis.gl/react-google-maps';
import { placesApi } from '../api';
import ErrorMessage from './ErrorMessage';

// The browser key only loads the map. Searching for places goes through our trip service,
// which holds the Places key (GraphQL nearbyPlaces).
export const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Advanced markers need a map ID. DEMO_MAP_ID is Google's ready-made one for development;
// create your own in Google Cloud (Map Management) and set VITE_GOOGLE_MAP_ID for production.
const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID';

const CATEGORIES = [
  ['', 'All'],
  ['attraction', 'Attractions'],
  ['food', 'Food'],
  ['museum', 'Museums'],
  ['nature', 'Nature'],
  ['shopping', 'Shopping'],
];

const SEARCH_DELAY_MS = 400; // wait until the map has stopped moving
const MIN_RADIUS = 300;
const MAX_RADIUS = 50000; // Google's limit for nearby search

// Distance in meters between two { lat, lng } points.
const distance = (a, b) => {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

// Skips a search when the view barely changed (a small drag or a click on a marker).
const isSameArea = (previous, next) =>
  previous &&
  previous.category === next.category &&
  distance(previous, next) < previous.radius * 0.25 &&
  next.radius / previous.radius > 0.75 &&
  next.radius / previous.radius < 1.35;

export default function PlaceMapPicker({ trip, plannedItems, itemCount, initialPosition, onAdd }) {
  const [start, setStart] = useState(null); // where the map opens
  const [category, setCategory] = useState('');
  const [position, setPosition] = useState(initialPosition);
  const [results, setResults] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(null);

  const mapRef = useRef(null);
  const timerRef = useRef(null);
  const lastSearchRef = useRef(null);
  const requestRef = useRef(0);
  const listRef = useRef(null);

  // Open on the places already planned for the day, or else on the trip's destination (once).
  useEffect(() => {
    const located = plannedItems.filter((item) => item.place.lat != null);
    if (located.length) {
      const lats = located.map((item) => item.place.lat);
      const lngs = located.map((item) => item.place.lng);
      const pad = 0.01;
      setStart({
        bounds: {
          north: Math.max(...lats) + pad,
          south: Math.min(...lats) - pad,
          east: Math.max(...lngs) + pad,
          west: Math.min(...lngs) - pad,
        },
      });
      return;
    }
    placesApi
      .locate(trip.destination)
      .then((place) => {
        const center = { lat: place.lat, lng: place.lng };
        const box = place.viewport;
        // A whole region (Tokyo's viewport is ~200 km) would open too far out, so use city zoom.
        const span = box ? distance({ lat: box.south, lng: box.west }, { lat: box.north, lng: box.east }) : Infinity;
        setStart(span <= 40000 ? { bounds: box } : { center, zoom: 13 });
      })
      .catch((err) => {
        setError(err.status === 404 ? { message: `Could not find "${trip.destination}" on the map. Drag the map to where you want to search.` } : err);
        setStart({ center: { lat: 20, lng: 0 }, zoom: 2 });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = useCallback(async (force = false) => {
    const map = mapRef.current;
    const bounds = map?.getBounds();
    const center = map?.getCenter();
    if (!bounds || !center) return;

    const here = { lat: center.lat(), lng: center.lng() };
    const corner = { lat: bounds.getNorthEast().lat(), lng: bounds.getNorthEast().lng() };
    // The circle that fits inside the visible map (about half the diagonal, a little smaller).
    const radius = Math.round(Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, distance(here, corner) * 0.8)));
    const next = { ...here, radius, category };
    if (!force && isSameArea(lastSearchRef.current, next)) return;
    lastSearchRef.current = next;

    const request = ++requestRef.current;
    setSearching(true);
    setError(null);
    try {
      const places = await placesApi.nearby({ lat: Number(here.lat.toFixed(5)), lng: Number(here.lng.toFixed(5)), radius, category });
      if (request !== requestRef.current) return; // a newer search has started
      setResults(places);
      setSelectedId((current) => (places.some((p) => p.googlePlaceId === current) ? current : null));
    } catch (err) {
      if (request === requestRef.current) setError(err);
    } finally {
      if (request === requestRef.current) setSearching(false);
    }
  }, [category]);

  // A new category searches the same area again right away.
  useEffect(() => {
    if (mapRef.current) search(true);
  }, [search]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleIdle = (event) => {
    mapRef.current = event.map;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(false), SEARCH_DELAY_MS);
  };

  const select = (googlePlaceId) => {
    setSelectedId(googlePlaceId);
    const row = listRef.current?.querySelector(`[data-place="${CSS.escape(googlePlaceId)}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const add = async (place) => {
    setAdding(place.googlePlaceId);
    setError(null);
    try {
      await onAdd({ googlePlaceId: place.googlePlaceId, position });
    } catch (err) {
      setError(err);
      setAdding(null);
    }
  };

  const planned = plannedItems.filter((item) => item.place.lat != null);

  return (
    <div className="map-picker">
      <div className="map-picker-toolbar">
        <div className="segmented" role="tablist" aria-label="Category">
          {CATEGORIES.map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={category === value} onClick={() => setCategory(value)}>
              {label}
            </button>
          ))}
        </div>
        <label className="field map-position">
          <span>Insert at</span>
          <select value={position} onChange={(event) => setPosition(Number(event.target.value))}>
            {Array.from({ length: itemCount + 1 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                #{n}{n === itemCount + 1 ? ' (end)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ErrorMessage error={error} />

      <div className="map-picker-body">
        <div className="map-frame">
          {start && (
            <APIProvider apiKey={MAPS_API_KEY}>
              <Map
                mapId={MAP_ID}
                defaultBounds={start.bounds}
                defaultCenter={start.bounds ? undefined : start.center}
                defaultZoom={start.bounds ? undefined : start.zoom}
                gestureHandling="greedy"
                disableDefaultUI
                zoomControl
                clickableIcons={false}
                onIdle={handleIdle}
              >
                {planned.map((item) => (
                  <AdvancedMarker key={`planned-${item.id}`} position={{ lat: item.place.lat, lng: item.place.lng }} title={`#${item.position} ${item.place.name}`} zIndex={1}>
                    <span className="marker marker-planned">{item.position}</span>
                  </AdvancedMarker>
                ))}
                {results.map((place, index) => (
                  <AdvancedMarker
                    key={place.googlePlaceId}
                    position={{ lat: place.lat, lng: place.lng }}
                    title={place.name}
                    zIndex={place.googlePlaceId === selectedId ? 10 : 2}
                    onClick={() => select(place.googlePlaceId)}
                  >
                    <span className={`marker${place.googlePlaceId === selectedId ? ' marker-selected' : ''}`}>
                      {String.fromCharCode(65 + (index % 26))}
                    </span>
                  </AdvancedMarker>
                ))}
              </Map>
            </APIProvider>
          )}
          {searching && <div className="map-status">Searching this area…</div>}
        </div>

        <ul className="map-results" ref={listRef}>
          {!searching && results.length === 0 && (
            <li className="muted small map-empty">No places here. Move or zoom the map, or try another category.</li>
          )}
          {results.map((place, index) => (
            <li
              key={place.googlePlaceId}
              data-place={place.googlePlaceId}
              className={`map-result${place.googlePlaceId === selectedId ? ' selected' : ''}`}
              onClick={() => setSelectedId(place.googlePlaceId)}
            >
              <span className="marker marker-small" aria-hidden="true">{String.fromCharCode(65 + (index % 26))}</span>
              <div className="map-result-info">
                <strong>{place.name}</strong>
                <span className="muted small">
                  {[place.type, place.rating != null && `★ ${place.rating.toFixed(1)} (${place.ratingCount?.toLocaleString() ?? 0})`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {place.address && <span className="muted small">{place.address}</span>}
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={adding !== null}
                onClick={(event) => {
                  event.stopPropagation();
                  add(place);
                }}
              >
                {adding === place.googlePlaceId ? 'Adding…' : `Add at #${position}`}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="muted small map-attribution">Places and map data © Google</p>
    </div>
  );
}
