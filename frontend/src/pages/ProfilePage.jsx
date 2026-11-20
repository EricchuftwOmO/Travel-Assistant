import { useEffect, useMemo, useState } from 'react';
import { profileApi } from '../api';
import { useAuth } from '../auth';
import ErrorMessage from '../components/ErrorMessage';

const TABS = [
  { id: 'basic', label: 'Basic Information' },
  { id: 'language', label: 'Language & Timezone' },
  { id: 'prefs', label: 'Travel Preferences' },
];

const GENDERS = [
  ['', 'Not set'],
  ['MALE', 'Male'],
  ['FEMALE', 'Female'],
  ['NON_BINARY', 'Non-binary'],
  ['OTHER', 'Other'],
  ['PREFER_NOT_TO_SAY', 'Prefer not to say'],
];

const COUNTRIES = [
  'Australia', 'Canada', 'China', 'France', 'Germany', 'Hong Kong', 'India', 'Indonesia', 'Italy',
  'Japan', 'Malaysia', 'Mexico', 'Netherlands', 'New Zealand', 'Philippines', 'Singapore',
  'South Korea', 'Spain', 'Taiwan', 'Thailand', 'United Kingdom', 'United States', 'Vietnam',
];

const LANGUAGES = [
  ['en', 'English'],
  ['zh-TW', '繁體中文 (Traditional Chinese)'],
  ['zh-CN', '简体中文 (Simplified Chinese)'],
  ['ja', '日本語 (Japanese)'],
  ['ko', '한국어 (Korean)'],
  ['es', 'Español (Spanish)'],
  ['fr', 'Français (French)'],
  ['de', 'Deutsch (German)'],
];

const BUDGET_LEVELS = [
  ['BUDGET', 'Budget', 'Hostels, street food, public transport'],
  ['MODERATE', 'Moderate', 'Mid-range hotels and a few splurges'],
  ['LUXURY', 'Luxury', 'Top hotels, fine dining, private tours'],
];

const TRAVEL_STYLES = [
  ['ADVENTURE', 'Adventure', '🧗'],
  ['NATURE', 'Nature', '🌲'],
  ['CULTURE', 'Culture', '🏛️'],
  ['FOOD', 'Food', '🍜'],
  ['RELAXATION', 'Relaxation', '🏖️'],
];

const FALLBACK_TIMEZONES = [
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Vancouver',
  'America/Mexico_City', 'Europe/London', 'Europe/Paris', 'Asia/Taipei', 'Asia/Tokyo', 'Asia/Seoul',
  'Asia/Shanghai', 'Asia/Singapore', 'Australia/Sydney', 'UTC',
];

const allTimezones = () => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return FALLBACK_TIMEZONES;
  }
};

// The editable values of each tab, from a loaded profile.
const formsFrom = (profile) => ({
  basic: {
    firstName: profile.firstName,
    lastName: profile.lastName,
    gender: profile.gender || '',
    dateOfBirth: profile.dateOfBirth || '',
    phone: profile.phone || '',
    country: profile.country || '',
  },
  language: { ...profile.languageSettings },
  prefs: {
    budgetLevel: profile.travelPreferences.budgetLevel || '',
    travelStyles: [...profile.travelPreferences.travelStyles],
  },
});

const sameValues = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Form values -> mutation input ('' means "clear this field").
const basicInput = (form) => ({
  firstName: form.firstName,
  lastName: form.lastName,
  gender: form.gender || null,
  dateOfBirth: form.dateOfBirth || null,
  phone: form.phone || null,
  country: form.country || null,
});

const prefsInput = (form) => ({ budgetLevel: form.budgetLevel || null, travelStyles: form.travelStyles });

export default function ProfilePage() {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [saved, setSaved] = useState(null); // the forms as last saved
  const [forms, setForms] = useState(null);
  const [tab, setTab] = useState('basic');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    profileApi
      .load()
      .then((me) => {
        setProfile(me);
        setSaved(formsFrom(me));
        setForms(formsFrom(me));
      })
      .catch(setError);
  }, []);

  const dirty = useMemo(() => {
    if (!forms) return {};
    return Object.fromEntries(TABS.map(({ id }) => [id, !sameValues(forms[id], saved[id])]));
  }, [forms, saved]);
  const anyDirty = Object.values(dirty).some(Boolean);

  const setField = (section, field) => (event) => {
    const value = event.target.value;
    setForms((current) => ({ ...current, [section]: { ...current[section], [field]: value } }));
    setNotice('');
  };

  const toggleStyle = (style) => {
    setForms((current) => {
      const styles = current.prefs.travelStyles;
      const next = styles.includes(style) ? styles.filter((s) => s !== style) : [...styles, style];
      return { ...current, prefs: { ...current.prefs, travelStyles: next } };
    });
    setNotice('');
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const result = await profileApi.save({
        basicInfo: dirty.basic ? basicInput(forms.basic) : undefined,
        languageSettings: dirty.language ? forms.language : undefined,
        travelPreferences: dirty.prefs ? prefsInput(forms.prefs) : undefined,
      });
      let next = profile;
      if (result.updateBasicInfo) {
        next = result.updateBasicInfo;
        updateUser({ name: next.name, firstName: next.firstName, lastName: next.lastName });
      }
      if (result.updateLanguageSettings) next = { ...next, languageSettings: result.updateLanguageSettings };
      if (result.updateTravelPreferences) next = { ...next, travelPreferences: result.updateTravelPreferences };
      setProfile(next);
      setSaved(formsFrom(next));
      setForms(formsFrom(next));
      setNotice('Changes saved.');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (!forms) {
    return error ? <ErrorMessage error={error} /> : <p className="muted">Loading your profile…</p>;
  }

  const initials = `${forms.basic.firstName.slice(0, 1)}${forms.basic.lastName.slice(0, 1)}`.toUpperCase();
  const timezones = allTimezones();
  if (!timezones.includes(forms.language.timezone)) timezones.unshift(forms.language.timezone);
  const countries = forms.basic.country && !COUNTRIES.includes(forms.basic.country)
    ? [forms.basic.country, ...COUNTRIES]
    : COUNTRIES;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>My Profile</h1>
          <p className="muted">Manage your personal details and travel preferences.</p>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy || !anyDirty} onClick={save}>
          {busy ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className="profile-tabs" role="tablist">
        {TABS.map(({ id, label }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
            {dirty[id] && <span className="dirty-dot" title="Unsaved changes" />}
          </button>
        ))}
      </div>

      <ErrorMessage error={error} />
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      <section className="card profile-card">
        {tab === 'basic' && (
          <div className="profile-basic">
            <div className="profile-avatar">
              <div className="avatar-large" aria-hidden="true">{initials || '?'}</div>
              <span className="muted small">Member since {profile.createdAt.slice(0, 4)}</span>
            </div>
            <div className="profile-fields">
              <label className="field">
                <span>First name</span>
                <input value={forms.basic.firstName} onChange={setField('basic', 'firstName')} maxLength={50} required />
              </label>
              <label className="field">
                <span>Last name</span>
                <input value={forms.basic.lastName} onChange={setField('basic', 'lastName')} maxLength={50} />
              </label>
              <label className="field">
                <span>Gender</span>
                <select value={forms.basic.gender} onChange={setField('basic', 'gender')}>
                  {GENDERS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Date of birth</span>
                <input
                  type="date"
                  value={forms.basic.dateOfBirth}
                  min="1900-01-01"
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={setField('basic', 'dateOfBirth')}
                />
              </label>
              <label className="field">
                <span>Phone</span>
                <input
                  type="tel"
                  value={forms.basic.phone}
                  onChange={setField('basic', 'phone')}
                  placeholder="+1 (253) 555-0198"
                  maxLength={30}
                />
              </label>
              <label className="field">
                <span>Country</span>
                <select value={forms.basic.country} onChange={setField('basic', 'country')}>
                  <option value="">Not set</option>
                  {countries.map((country) => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </label>
              <label className="field field-wide">
                <span>Email</span>
                <input value={profile.email} readOnly aria-describedby="email-note" />
                <small id="email-note" className="muted small">Changing your email needs a separate verification step.</small>
              </label>
            </div>
          </div>
        )}

        {tab === 'language' && (
          <div className="profile-fields">
            <label className="field">
              <span>Language</span>
              <select value={forms.language.language} onChange={setField('language', 'language')}>
                {!LANGUAGES.some(([code]) => code === forms.language.language) && (
                  <option value={forms.language.language}>{forms.language.language}</option>
                )}
                {LANGUAGES.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Timezone</span>
              <select value={forms.language.timezone} onChange={setField('language', 'timezone')}>
                {timezones.map((zone) => (
                  <option key={zone} value={zone}>{zone.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </label>
            <p className="muted small field-wide">
              Local time there now:{' '}
              <strong>
                {new Date().toLocaleString(undefined, {
                  timeZone: forms.language.timezone,
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </strong>
            </p>
          </div>
        )}

        {tab === 'prefs' && (
          <div className="profile-prefs">
            <fieldset className="pref-group">
              <legend>Budget level</legend>
              <div className="budget-options">
                {BUDGET_LEVELS.map(([value, label, hint]) => (
                  <label key={value} className={`option-card${forms.prefs.budgetLevel === value ? ' selected' : ''}`}>
                    <input
                      type="radio"
                      name="budgetLevel"
                      value={value}
                      checked={forms.prefs.budgetLevel === value}
                      onChange={setField('prefs', 'budgetLevel')}
                    />
                    <strong>{label}</strong>
                    <span className="muted small">{hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="pref-group">
              <legend>Travel styles</legend>
              <p className="muted small">Pick everything you enjoy.</p>
              <div className="chips">
                {TRAVEL_STYLES.map(([value, label, icon]) => (
                  <button
                    key={value}
                    type="button"
                    className="chip"
                    aria-pressed={forms.prefs.travelStyles.includes(value)}
                    onClick={() => toggleStyle(value)}
                  >
                    <span aria-hidden="true">{icon}</span> {label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </section>
    </div>
  );
}
