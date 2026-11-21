import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { userApi } from '../api';
import { useAuth } from '../auth';
import ErrorMessage from '../components/ErrorMessage';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={location.state?.from || '/trips'} replace />;

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === 'login'
          ? await userApi.login(form.email, form.password)
          : await userApi.register({ name: form.name, email: form.email, password: form.password });
      signIn(result);
      navigate(location.state?.from || '/trips', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async (credential) => {
    setBusy(true);
    setError(null);
    try {
      signIn(await userApi.loginWithGoogle(credential));
      navigate(location.state?.from || '/trips', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
  };

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <p className="eyebrow">Your next escape starts here</p>
        <h1>Less planning. More going.</h1>
        <p className="muted">
          Find a flight, build your trip, and map out every day — all in one place.
        </p>
      </section>

      <section className="card auth-card">
        <h2>{mode === 'login' ? 'Log in' : 'Create an account'}</h2>
        <form className="form" onSubmit={submit}>
          {mode === 'register' && (
            <label className="field">
              <span>Name</span>
              <input value={form.name} onChange={set('name')} autoComplete="name" required maxLength={100} />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 8 : undefined}
              required
            />
          </label>
          <ErrorMessage error={error} />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        <GoogleSignInButton onCredential={googleSignIn} onError={setError} />
        <p className="muted small">
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <button type="button" className="link-btn" onClick={switchMode}>
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </button>
        </p>
        {mode === 'login' && (
          <p className="hint small">
            Demo account: <code>alice@example.com</code> / <code>Password123!</code>
          </p>
        )}
      </section>
    </div>
  );
}
