import { useEffect, useRef } from 'react';

// "Sign in with Google" (Google Identity Services). Google gives the browser an ID token, and onCredential
// sends it to our API, which verifies it. Renders nothing when VITE_GOOGLE_CLIENT_ID is not set.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

const loadGoogleScript = () =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    const script = existing || Object.assign(document.createElement('script'), { src: SCRIPT_SRC, async: true });
    script.addEventListener('load', resolve);
    script.addEventListener('error', () => reject(new Error('Could not load Google Sign-In')));
    if (!existing) document.head.appendChild(script);
  });

export default function GoogleSignInButton({ onCredential, onError }) {
  const container = useRef(null);
  // Keep the latest callbacks without re-rendering Google's button
  const handlers = useRef({ onCredential, onError });
  handlers.current = { onCredential, onError };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !container.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => handlers.current.onCredential(response.credential),
        });
        window.google.accounts.id.renderButton(container.current, { theme: 'outline', size: 'large', width: 320 });
      })
      .catch((err) => handlers.current.onError?.(err));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;
  return <div ref={container} className="google-button" />;
}
