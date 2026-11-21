import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { airportByCode, searchAirports } from '../airports';

// "Taipei (TPE)" for a known airport, the plain code otherwise.
const labelFor = (code) => {
  const airport = airportByCode(code);
  return airport ? `${airport.city} (${airport.code})` : code || '';
};

const CODE = /^[A-Za-z]{3}$/;

// An airport field with suggestions: typing "t" suggests Taipei, Tokyo, Toronto...
// value / onChange use the 3-letter IATA code; the field shows the city with the code.
export default function AirportInput({ value, onChange, placeholder, label }) {
  const listId = useId();
  const [text, setText] = useState(() => labelFor(value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const emitted = useRef(value);

  // A value set from outside (e.g. "Show all" clearing the form) replaces what is shown.
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setText(labelFor(value));
    }
  }, [value]);

  const results = useMemo(() => (open ? searchAirports(text) : []), [open, text]);

  const emit = (code) => {
    emitted.current = code;
    onChange(code);
  };

  const choose = (airport) => {
    emit(airport.code);
    setText(labelFor(airport.code));
    setOpen(false);
  };

  // Leaving the field (or Enter) settles what was typed: a suggestion, a raw code, or nothing.
  const settle = () => {
    const typed = text.trim();
    if (!typed) emit('');
    else if (typed === labelFor(value)) {
      // already the chosen airport
    } else if (results[active]) choose(results[active]);
    else if (CODE.test(typed)) {
      emit(typed.toUpperCase());
      setText(labelFor(typed.toUpperCase()));
    }
    setOpen(false);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (results.length) {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive((current) => (current + step + results.length) % results.length);
      }
    } else if (event.key === 'Enter' && open) {
      event.preventDefault(); // choose the suggestion instead of submitting the form
      settle();
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="airport-input">
      <input
        value={text}
        placeholder={placeholder}
        aria-label={label}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
          setActive(0);
          if (!event.target.value.trim()) emit('');
        }}
        onFocus={(event) => event.target.select()}
        onBlur={settle}
        onKeyDown={onKeyDown}
      />
      {open && results.length > 0 && (
        <ul className="airport-options" id={listId} role="listbox">
          {results.map((airport, index) => (
            <li
              key={airport.code}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? 'active' : undefined}
              // mousedown, not click: it fires before the input's blur
              onMouseDown={(event) => {
                event.preventDefault();
                choose(airport);
              }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="airport-code">{airport.code}</span>
              <span className="airport-text">
                <strong>{airport.city}</strong>
                <span className="muted small">
                  {airport.name}, {airport.country}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
