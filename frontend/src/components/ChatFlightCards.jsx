import { useEffect, useState } from 'react';
import { tripsApi } from '../api';
import { formatDateTime, formatLocalTime, formatMoney, formatRange } from '../format';
import ErrorMessage from './ErrorMessage';
import Modal from './Modal';

const stopsLabel = (stops) => (stops == null ? '' : stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`);

const times = (flight) =>
  flight.departLocal && flight.arriveLocal
    ? `${formatLocalTime(flight.departLocal)} → ${formatLocalTime(flight.arriveLocal)}`
    : `${formatDateTime(flight.departAt)} → ${formatDateTime(flight.arriveAt)}`;

// Flights the assistant found, under its answer. The assistant only searched; adding one to a trip
// happens here, after the user picks a trip and confirms.
export default function ChatFlightCards({ flights, currentTrip }) {
  const [adding, setAdding] = useState(null); // the flight being added
  const [added, setAdded] = useState({}); // flight id -> trip title

  if (!flights?.length) return null;

  return (
    <div className="chat-flights">
      {flights.map((flight) => (
        <div key={flight.id} className="chat-flight">
          <div className="chat-flight-main">
            <strong>
              {flight.origin} → {flight.destination}
            </strong>
            <span className="chat-flight-price">{formatMoney(flight.price, flight.currency || 'USD')}</span>
          </div>
          <div className="muted small">
            {flight.airline} {flight.flightNumber} · {stopsLabel(flight.stops)}
          </div>
          <div className="muted small">{times(flight)}</div>
          {added[flight.id] ? (
            <span className="chat-flight-added">✓ Added to {added[flight.id]}</span>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(flight)}>
              Add to Trip
            </button>
          )}
        </div>
      ))}
      {adding && (
        <ConfirmAddDialog
          flight={adding}
          currentTrip={currentTrip}
          onClose={() => setAdding(null)}
          onAdded={(trip) => {
            setAdded((current) => ({ ...current, [adding.id]: trip.title }));
            setAdding(null);
          }}
        />
      )}
    </div>
  );
}

function ConfirmAddDialog({ flight, currentTrip, onClose, onAdded }) {
  const [trips, setTrips] = useState(null);
  const [tripId, setTripId] = useState(currentTrip ? String(currentTrip.id) : '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    tripsApi
      .list({ status: 'upcoming' })
      .then((list) => {
        // The trip on screen first, even if it is not upcoming.
        const all = currentTrip && !list.some((t) => String(t.id) === String(currentTrip.id)) ? [currentTrip, ...list] : list;
        setTrips(all);
        setTripId((current) => current || (all[0] ? String(all[0].id) : ''));
      })
      .catch(setError);
  }, [currentTrip]);

  const trip = trips?.find((t) => String(t.id) === tripId);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await tripsApi.attachFlight(tripId, flight.id);
      onAdded(trip);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add this flight to a trip?"
      onClose={onClose}
      footer={
        trips?.length ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy || !tripId}>
              {busy ? 'Adding…' : 'Confirm and add'}
            </button>
          </>
        ) : null
      }
    >
      <p>
        <strong>
          {flight.airline} {flight.flightNumber}
        </strong>{' '}
        · {flight.origin} → {flight.destination} · {times(flight)} · {formatMoney(flight.price, flight.currency || 'USD')}
      </p>
      <p className="muted small">Suggested by the AI assistant. Prices come from the flight search, not the model.</p>
      {trips === null ? (
        !error && <p className="muted">Loading your trips…</p>
      ) : trips.length === 0 ? (
        <div className="empty">You have no upcoming trips. Create one in My Trips first.</div>
      ) : (
        <label className="field">
          <span>Trip</span>
          <select value={tripId} onChange={(event) => setTripId(event.target.value)}>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({formatRange(t.startDate, t.endDate)})
              </option>
            ))}
          </select>
        </label>
      )}
      <ErrorMessage error={error} />
    </Modal>
  );
}
