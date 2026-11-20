import { useState } from 'react';

// The fields of a trip. Used by "New Trip" (My Trips) and "Create New Trip" (Flight Search).
export default function TripForm({ initial, onSubmit, submitLabel, busy, children }) {
  const [form, setForm] = useState({
    title: '',
    destination: '',
    startDate: '',
    endDate: '',
    ...initial,
  });
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <label className="field">
        <span>Trip name</span>
        <input value={form.title} onChange={set('title')} placeholder="Japan Trip" required maxLength={120} />
      </label>
      <label className="field">
        <span>Destination</span>
        <input value={form.destination} onChange={set('destination')} placeholder="Tokyo" required maxLength={120} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Start date</span>
          <input type="date" value={form.startDate} onChange={set('startDate')} required />
        </label>
        <label className="field">
          <span>End date</span>
          <input type="date" value={form.endDate} min={form.startDate || undefined} onChange={set('endDate')} required />
        </label>
      </div>
      {children}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
