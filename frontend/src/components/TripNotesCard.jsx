import { useState } from 'react';
import { tripNotesApi } from '../api';
import ErrorMessage from './ErrorMessage';

const CATEGORY = {
  entry: ['🛂', 'Entry'],
  culture: ['🙏', 'Culture'],
  weather: ['🌦️', 'Weather'],
  money: ['💵', 'Money'],
  transport: ['🚆', 'Getting around'],
  electricity: ['🔌', 'Plugs'],
  health: ['🩺', 'Health'],
  safety: ['🛡️', 'Safety'],
  itinerary: ['🗓️', 'Your plan'],
};

// Notes already fetched, kept while the app is open so switching tabs does not ask again.
const fetched = new Map();

// "Before you go": pre-trip notes from the LLM service's fixed chain (read-only, nothing is saved).
export default function TripNotesCard({ trip, onOpenDay }) {
  const [result, setResult] = useState(() => fetched.get(trip.id) || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const notes = await tripNotesApi.get(trip.id);
      fetched.set(trip.id, notes);
      setResult(notes);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card trip-notes">
      <div className="card-header">
        <h2>Before you go</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          {loading ? 'Checking…' : result ? 'Refresh' : '✨ Get notes'}
        </button>
      </div>
      <ErrorMessage error={error} />

      {!result && !loading && (
        <p className="muted">
          What to know for {trip.destination} on these dates: customs, weather, money, plugs, and anything in your plan
          that needs a second look.
        </p>
      )}
      {loading && <p className="muted">Reading your trip and writing notes… this can take a few seconds.</p>}

      {result && (
        <>
          <p className="muted small notes-source">
            {result.source === 'llm'
              ? 'Written by AI from your trip, then checked by the app. Always confirm entry rules on official sites.'
              : 'Basic notes from your trip details (the AI is not available right now).'}
          </p>
          <ul className="note-list">
            {result.notes.map((note, index) => {
              const [icon, label] = CATEGORY[note.category] || ['•', note.category];
              return (
                <li key={index} className={`note note-${note.priority}`}>
                  <span className="note-icon" aria-hidden="true">{icon}</span>
                  <div>
                    <div className="note-title">
                      <strong>{note.title}</strong>
                      <span className="badge">{label}</span>
                      {note.priority === 'high' && <span className="badge badge-high">Important</span>}
                      {note.day && (
                        <button type="button" className="link-btn small" onClick={() => onOpenDay(note.day)}>
                          Day {note.day} →
                        </button>
                      )}
                    </div>
                    <p className="muted small">{note.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
