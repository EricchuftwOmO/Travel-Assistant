import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { dayCount, formatRange } from '../format';
import ErrorMessage from '../components/ErrorMessage';
import Modal from '../components/Modal';
import TripForm from '../components/TripForm';

const FILTERS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: '', label: 'All' },
];

// Screen 02: every trip of the user, and a "New Trip" dialog (a trip needs no flight).
export default function MyTripsPage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState(null);
  const [status, setStatus] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null); // the trip waiting for confirmation

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    try {
      setTrips(await api(`/api/trips?${params}`));
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [status, search]);

  useEffect(() => {
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Screen 02</p>
          <h1>My Trips</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          + New Trip
        </button>
      </div>

      <div className="toolbar">
        <div className="segmented" role="tablist">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={status === filter.value}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <input
          className="search-input"
          type="search"
          placeholder="Search trip names"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <ErrorMessage error={error} />

      {trips === null ? (
        !error && <p className="muted">Loading trips…</p>
      ) : trips.length === 0 ? (
        <div className="empty">
          No trips here yet. Create a blank trip, or start from a{' '}
          <Link to="/flights">flight search</Link>.
        </div>
      ) : (
        <ul className="trip-grid">
          {trips.map((trip) => (
            <li key={trip.id} className="trip-item">
              <Link to={`/trips/${trip.id}`} className="card trip-card">
                <span className="trip-dates">{formatRange(trip.startDate, trip.endDate).toUpperCase()}</span>
                <strong className="trip-title">{trip.title}</strong>
                <span className="muted">
                  {trip.destination} · {dayCount(trip.startDate, trip.endDate)} days
                </span>
              </Link>
              {/* Outside the link, so clicking it never opens the trip. */}
              <button
                type="button"
                className="icon-btn danger trip-delete"
                aria-label={`Delete ${trip.title}`}
                title="Delete trip"
                onClick={() => setDeleting(trip)}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating && <NewTripDialog onClose={() => setCreating(false)} onCreated={(trip) => navigate(`/trips/${trip.id}`)} />}
      {deleting && (
        <DeleteTripDialog
          trip={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setTrips((current) => current.filter((t) => t.id !== deleting.id));
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}

// Deleting cannot be undone, so it always asks first and says what goes with the trip.
function DeleteTripDialog({ trip, onClose, onDeleted }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/trips/${trip.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Delete trip?"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger-solid" onClick={remove} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete trip'}
          </button>
        </>
      }
    >
      <p>
        <strong>{trip.title}</strong> ({formatRange(trip.startDate, trip.endDate)}) will be deleted with all of its days,
        places and flights.
      </p>
      <p className="muted small">This cannot be undone.</p>
      <ErrorMessage error={error} />
    </Modal>
  );
}

function NewTripDialog({ onClose, onCreated }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const create = async (form) => {
    setBusy(true);
    setError(null);
    try {
      onCreated(await api('/api/trips', { method: 'POST', body: form }));
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Modal title="New Trip" onClose={onClose}>
      <p className="muted small">Flights, places and days can all be added later. Empty trips are fine.</p>
      <ErrorMessage error={error} />
      <TripForm onSubmit={create} submitLabel="Create trip" busy={busy} />
    </Modal>
  );
}
