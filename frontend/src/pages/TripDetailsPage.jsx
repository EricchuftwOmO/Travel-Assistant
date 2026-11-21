import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { placesApi, tripsApi } from '../api';
import { dayCount, formatDate, formatDateTime, formatMoney, formatRange } from '../format';
import ErrorMessage from '../components/ErrorMessage';
import Modal from '../components/Modal';
import TripForm from '../components/TripForm';
import PlaceMapPicker, { MAPS_API_KEY } from '../components/PlaceMapPicker';

// Screen 03: an Overview tab plus one tab per travel day. The tab is kept in the URL (?day=2).
export default function TripDetailsPage() {
  const { tripId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [trip, setTrip] = useState(null);
  const [days, setDays] = useState([]);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const loaded = await tripsApi.get(tripId); // the trip, its flights and its days, in one request
      setTrip(loaded);
      setDays(loaded.itineraries);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeDay = Number(searchParams.get('day')) || 0;
  const selectTab = (day) => setSearchParams(day ? { day: String(day) } : {}, { replace: true });

  if (error && !trip) {
    // 404 also covers another user's trip: the service does not say which, to keep trips private.
    if (error.status === 404) {
      return (
        <div className="page">
          <div className="card not-found">
            <span className="not-found-icon" aria-hidden="true">🧭</span>
            <h1>This trip isn't available</h1>
            <p className="muted">It may have been deleted, or it belongs to another account.</p>
            <Link to="/trips" className="btn btn-primary">Go to My Trips</Link>
          </div>
        </div>
      );
    }
    return (
      <div className="page">
        <Link to="/trips" className="back-link">← My Trips</Link>
        <ErrorMessage error={error} />
      </div>
    );
  }
  if (!trip) return <p className="muted page">Loading trip…</p>;

  return (
    <div className="page">
      <Link to="/trips" className="back-link">← My Trips</Link>
      <div className="page-header">
        <div>
          <h1>{trip.title}</h1>
          <p className="muted">
            {formatRange(trip.startDate, trip.endDate)} · {dayCount(trip.startDate, trip.endDate)} days · {trip.destination}
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
          Edit trip
        </button>
      </div>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={activeDay === 0} onClick={() => selectTab(0)}>
          Overview
        </button>
        {days.map((day) => (
          <button
            key={day.id}
            type="button"
            role="tab"
            aria-selected={activeDay === day.dayNumber}
            onClick={() => selectTab(day.dayNumber)}
          >
            Day {day.dayNumber}
          </button>
        ))}
      </div>

      {activeDay === 0 ? (
        <OverviewTab trip={trip} onChanged={load} />
      ) : (
        <DayTab key={activeDay} trip={trip} dayNumber={activeDay} />
      )}

      {editing && (
        <EditTripDialog
          trip={trip}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            selectTab(0);
            load();
          }}
        />
      )}
    </div>
  );
}

function OverviewTab({ trip, onChanged }) {
  const [error, setError] = useState(null);

  const removeFlight = async (flight) => {
    if (!window.confirm(`Remove ${flight.airline} ${flight.flightNumber} from this trip?`)) return;
    try {
      await tripsApi.detachFlight(trip.id, flight.id);
      onChanged();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="overview-grid">
      <section className="card">
        <div className="card-header">
          <h2>Flights</h2>
          <Link to="/flights" className="btn btn-ghost btn-sm">+ Find a flight</Link>
        </div>
        <ErrorMessage error={error} />
        {trip.flights.length === 0 ? (
          <p className="muted">No flight yet. Flights are optional.</p>
        ) : (
          <ul className="plain-list">
            {trip.flights.map((flight) => (
              <li key={flight.id} className="row-item">
                <div>
                  <strong>
                    {flight.origin} → {flight.destination}
                  </strong>{' '}
                  · {flight.airline} {flight.flightNumber}
                  <div className="muted small">
                    {formatDateTime(flight.departAt)} → {formatDateTime(flight.arriveAt)} ·{' '}
                    {formatMoney(flight.price, flight.currency)}
                  </div>
                </div>
                <button type="button" className="icon-btn" aria-label="Remove flight" onClick={() => removeFlight(flight)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>


      <section className="card card-muted">
        <h2>Trip members &amp; shared expenses</h2>
        <p className="muted">Inviting members and splitting costs is planned for a later version.</p>
      </section>
    </div>
  );
}

function DayTab({ trip, dayNumber }) {
  const [day, setDay] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(null); // null, or the position to insert at
  const [dragIndex, setDragIndex] = useState(null);

  const load = useCallback(async () => {
    try {
      setDay(await tripsApi.day(trip.id, dayNumber));
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [trip.id, dayNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const saveOrder = async (items) => {
    setDay((current) => ({ ...current, items })); // show the new order right away
    try {
      setDay(await tripsApi.reorder(trip.id, dayNumber, items.map((item) => item.id)));
    } catch (err) {
      setError(err);
      load();
    }
  };

  const move = (from, to) => {
    if (to < 0 || to >= day.items.length || from === to) return;
    const items = [...day.items];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    saveOrder(items);
  };

  const remove = async (item) => {
    try {
      await tripsApi.removeItem(trip.id, dayNumber, item.id);
      load();
    } catch (err) {
      setError(err);
    }
  };

  if (!day) return error ? <ErrorMessage error={error} /> : <p className="muted">Loading day…</p>;

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Day {day.dayNumber}</h2>
          <p className="muted small">{formatDate(day.date)}</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(day.items.length + 1)}>
          + Add place
        </button>
      </div>

      <ErrorMessage error={error} />

      {day.items.length === 0 ? (
        <div className="empty">Nothing planned for this day yet.</div>
      ) : (
        <ol className="itinerary">
          {day.items.map((item, index) => (
            <li
              key={item.id}
              className={`itinerary-item${dragIndex === index ? ' dragging' : ''}`}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                move(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
            >
              <span className="drag-handle" aria-hidden="true">⋮⋮</span>
              <span className="position">{String(index + 1).padStart(2, '0')}</span>
              <div className="place-info">
                <strong>{item.place.name}</strong>
                <span className="muted small">
                  {item.place.address || `${item.place.city} · ${item.place.category}`}
                </span>
              </div>
              <div className="item-actions">
                <button type="button" className="icon-btn" aria-label="Move up" disabled={index === 0} onClick={() => move(index, index - 1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Move down"
                  disabled={index === day.items.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  ↓
                </button>
                <button type="button" className="icon-btn" aria-label="Insert a place here" title="Insert a place here" onClick={() => setAdding(index + 1)}>
                  +
                </button>
                <button type="button" className="icon-btn danger" aria-label="Remove" onClick={() => remove(item)}>
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="muted small">Drag places, or use the arrows, to change the order.</p>

      {adding !== null && (
        <AddPlaceDialog
          trip={trip}
          dayNumber={dayNumber}
          dayItems={day.items}
          itemCount={day.items.length}
          initialPosition={adding}
          onClose={() => setAdding(null)}
          onAdded={() => {
            setAdding(null);
            load();
          }}
        />
      )}
    </section>
  );
}

// Google map when both keys are set up; otherwise (or on request) the sample catalog.
function AddPlaceDialog({ trip, dayNumber, dayItems, itemCount, initialPosition, onClose, onAdded }) {
  const [mode, setMode] = useState(MAPS_API_KEY ? 'checking' : 'catalog');
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    if (!MAPS_API_KEY) return;
    placesApi
      .config()
      .then((config) => {
        setGoogleReady(config.googlePlaces);
        setMode(config.googlePlaces ? 'map' : 'catalog');
      })
      .catch(() => setMode('catalog'));
  }, []);

  const addGooglePlace = async ({ googlePlaceId, position }) => {
    await tripsApi.addItem(trip.id, dayNumber, { googlePlaceId, position });
    onAdded();
  };

  if (mode === 'checking') {
    return (
      <Modal title="Add a place" onClose={onClose} wide>
        <p className="muted">Loading the map…</p>
      </Modal>
    );
  }

  if (mode === 'map') {
    return (
      <Modal title="Add a place" onClose={onClose} wide>
        <PlaceMapPicker
          trip={trip}
          plannedItems={dayItems}
          itemCount={itemCount}
          initialPosition={initialPosition}
          onAdd={addGooglePlace}
        />
        <button type="button" className="link-btn small" onClick={() => setMode('catalog')}>
          Use the sample place list instead
        </button>
      </Modal>
    );
  }

  return (
    <CatalogPlaceDialog
      trip={trip}
      dayNumber={dayNumber}
      itemCount={itemCount}
      initialPosition={initialPosition}
      onClose={onClose}
      onAdded={onAdded}
      mapAvailable={googleReady}
      onUseMap={() => setMode('map')}
    />
  );
}

// The sample place catalog: works without any Google key.
function CatalogPlaceDialog({ trip, dayNumber, itemCount, initialPosition, onClose, onAdded, mapAvailable, onUseMap }) {
  const [city, setCity] = useState(trip.destination);
  const [category, setCategory] = useState('');
  const [places, setPlaces] = useState(null);
  const [position, setPosition] = useState(initialPosition);
  const [error, setError] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      placesApi.catalog({ city: city.trim(), category }).then(setPlaces).catch(setError);
    }, 200);
    return () => clearTimeout(timer);
  }, [city, category]);

  const add = async (place) => {
    try {
      await tripsApi.addItem(trip.id, dayNumber, { placeId: place.id, position });
      onAdded();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <Modal title="Add a place" onClose={onClose} wide>
      <div className="field-row">
        <label className="field">
          <span>City</span>
          <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Any city" />
        </label>
        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Any</option>
            {['attraction', 'food', 'museum', 'nature', 'shopping'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Insert at position</span>
          <select value={position} onChange={(event) => setPosition(Number(event.target.value))}>
            {Array.from({ length: itemCount + 1 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                #{n}
                {n === itemCount + 1 ? ' (end)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ErrorMessage error={error} />
      {mapAvailable ? (
        <button type="button" className="link-btn small" onClick={onUseMap}>
          Pick on the Google map instead
        </button>
      ) : (
        <p className="hint small">Showing sample places. Set a Google Maps key to pick places on a map.</p>
      )}
      {places === null ? (
        <p className="muted">Searching…</p>
      ) : places.length === 0 ? (
        <div className="empty">
          No places found{city ? ` in "${city}"` : ''}.{' '}
          {city && (
            <button type="button" className="link-btn" onClick={() => setCity('')}>
              Show every city
            </button>
          )}
        </div>
      ) : (
        <ul className="place-results">
          {places.map((place) => (
            <li key={place.id} className="row-item">
              <div>
                <strong>{place.name}</strong>
                <div className="muted small">
                  {place.city} · {place.category}
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => add(place)}>
                Add at #{position}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function EditTripDialog({ trip, onClose, onSaved }) {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async (form) => {
    setBusy(true);
    setError(null);
    try {
      await tripsApi.update(trip.id, form);
      onSaved();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${trip.title}" with all its days and flights? This cannot be undone.`)) return;
    try {
      await tripsApi.remove(trip.id);
      navigate('/trips');
    } catch (err) {
      setError(err);
    }
  };

  return (
    <Modal title="Edit trip" onClose={onClose}>
      <ErrorMessage error={error} />
      <TripForm
        initial={{ title: trip.title, destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate }}
        onSubmit={save}
        submitLabel="Save changes"
        busy={busy}
      />
      <hr />
      <button type="button" className="btn btn-danger" onClick={remove}>
        Delete trip
      </button>
    </Modal>
  );
}
