import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMatch } from 'react-router-dom';
import { adviceApi, tripsApi } from '../api';
import { useAuth } from '../auth';
import ChatMarkdown from './ChatMarkdown';

// The AI Travel Assistant as a floating chat. It uses the gateway's GraphQL API (myAdvice and
// askAdvice), which takes the user from the login token, so a client cannot ask as someone else.
// On a trip page the questions carry that trip, so answers can be specific to it.
// Each question is answered on its own: the LLM service keeps no conversation memory.
//
// Every login starts with an empty chat (the widget is only mounted while someone is signed in).
// Earlier conversations stay on the server and are loaded only when asked for, 20 at a time.

const TRIP_NOTE = '\n\n(Trip: ';
const HISTORY_PAGE = 20;

// Saved prompts carry the trip details after the question; show only the question.
const questionOf = (prompt) => prompt.split(TRIP_NOTE)[0];

const toMessages = (advice) => [
  { id: `q${advice.id}`, role: 'user', text: questionOf(advice.prompt) },
  { id: `a${advice.id}`, role: 'assistant', text: advice.content, stub: advice.source === 'stub' },
];

const suggestionsFor = (trip) =>
  trip
    ? [
        `What should I pack for ${trip.destination}?`,
        `Must-try food in ${trip.destination}?`,
        `How should I get around ${trip.destination}?`,
      ]
    : ['Tips for a long-haul flight?', 'How do I find cheap flights?', 'What travel insurance do I need?'];

export default function ChatWidget() {
  const { user } = useAuth();
  const tripMatch = useMatch('/trips/:tripId');
  const tripId = tripMatch?.params.tripId;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // this session
  // Earlier conversations: null until asked for, then a list of messages (oldest first).
  const [history, setHistory] = useState(null);
  const [historyStatus, setHistoryStatus] = useState('idle'); // idle | loading | error
  const [historyLimit, setHistoryLimit] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [trip, setTrip] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const scrollKeepRef = useRef(null); // the list's height before older messages were added on top

  // Loads earlier questions and answers (all trips), one more page each time. They arrive newest
  // first, so they are reversed to read top to bottom. Questions asked in this session are already
  // on screen below, so they are left out here.
  const loadHistory = async () => {
    if (historyStatus === 'loading') return;
    const limit = historyLimit + HISTORY_PAGE;
    setHistoryStatus('loading');
    try {
      const answers = await adviceApi.recent(undefined, limit);
      const shown = new Set(messages.map((message) => message.id));
      scrollKeepRef.current = listRef.current?.scrollHeight ?? null;
      setHistory([...answers].reverse().filter((advice) => !shown.has(`a${advice.id}`)).flatMap(toMessages));
      setHistoryLimit(limit);
      setHasMoreHistory(answers.length === limit);
      setHistoryStatus('idle');
    } catch {
      setHistoryStatus('error');
    }
  };

  // Older messages are added above, so keep the view where it was instead of jumping.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || scrollKeepRef.current === null) return;
    list.scrollTop += list.scrollHeight - scrollKeepRef.current;
    scrollKeepRef.current = null;
  }, [history]);

  // The header button: load earlier conversations (if not yet) and go to the top of the chat.
  const showHistory = () => {
    if (history === null) loadHistory();
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // The trip on screen, if any, so the assistant knows which trip "this trip" means.
  useEffect(() => {
    if (!tripId) {
      setTrip(null);
      return;
    }
    let cancelled = false;
    tripsApi
      .get(tripId)
      .then((loaded) => !cancelled && setTrip(loaded))
      .catch(() => !cancelled && setTrip(null));
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  // Keep the newest message in view, and put the cursor in the box when the chat opens.
  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, sending]);

  useEffect(() => {
    if (open) {
      setUnread(false);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (text) => {
    const question = text.trim();
    if (!question || sending) return;
    const localId = Date.now();
    setMessages((current) => [...current, { id: `local-q${localId}`, role: 'user', text: question }]);
    setDraft('');
    setSending(true);

    const tripNote = trip ? `${TRIP_NOTE}${trip.title}, ${trip.destination}, ${trip.startDate} to ${trip.endDate})` : '';
    try {
      // No user id is sent: the gateway takes it from the login token.
      const advice = await adviceApi.ask({
        tripId: trip?.id,
        topic: 'general',
        prompt: `${question.slice(0, 1000 - tripNote.length)}${tripNote}`,
      });
      setMessages((current) => [
        ...current,
        { id: `a${advice.id}`, role: 'assistant', text: advice.content, stub: advice.source === 'stub' },
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        { id: `local-e${localId}`, role: 'error', text: err.message || 'The assistant is not available right now.', retry: question },
      ]);
    } finally {
      setSending(false);
      if (!panelRef.current?.isConnected) setUnread(true);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (event) => {
    // Enter sends; Shift+Enter makes a new line. Ignore Enter while an IME (e.g. Chinese input) is composing.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(draft);
    }
  };

  return (
    <>
      {open && (
        <section className="chat-panel" ref={panelRef} role="dialog" aria-label="AI Travel Assistant">
          <header className="chat-header">
            <span className="chat-avatar" aria-hidden="true">✦</span>
            <div className="chat-title">
              <strong>AI Travel Assistant</strong>
              <span className="chat-context">{trip ? `About: ${trip.title}` : 'Ask me anything about travel'}</span>
            </div>
            <button
              type="button"
              className="icon-btn chat-close"
              aria-label="Show earlier conversations"
              title="Earlier conversations"
              onClick={showHistory}
            >
              🕘
            </button>
            <button type="button" className="icon-btn chat-close" aria-label="Close chat" onClick={() => setOpen(false)}>
              ✕
            </button>
          </header>

          <div className="chat-messages" ref={listRef} aria-live="polite">
            <div className="chat-history-bar">
              {historyStatus === 'loading' ? (
                <span className="muted small">Loading earlier conversations…</span>
              ) : historyStatus === 'error' ? (
                <button type="button" className="link-btn small" onClick={loadHistory}>
                  Couldn't load earlier conversations. Try again
                </button>
              ) : history === null ? (
                <button type="button" className="chat-history-btn" onClick={loadHistory}>
                  🕘 View earlier conversations
                </button>
              ) : hasMoreHistory ? (
                <button type="button" className="chat-history-btn" onClick={loadHistory}>
                  Load older
                </button>
              ) : (
                <span className="muted small">
                  {history.length ? 'That’s everything from before.' : 'No earlier conversations.'}
                </span>
              )}
            </div>

            {history?.map((message) => (
              <div key={`h-${message.id}`} className={`chat-row chat-row-${message.role === 'user' ? 'user' : 'bot'} chat-row-old`}>
                <div className={`chat-bubble chat-bubble-${message.role}`}>
                  {message.stub
                    ? questionOf(message.text)
                    : message.role === 'assistant'
                      ? <ChatMarkdown text={message.text} />
                      : message.text}
                </div>
              </div>
            ))}
            {history?.length > 0 && (
              <div className="chat-divider" role="separator">
                <span>This session</span>
              </div>
            )}

            {messages.length === 0 && !sending && (
              <div className="chat-welcome">
                <p>
                  Hi {user.firstName || user.name}! 👋 I can help with packing, food, getting around and more.
                  {trip && ` I'll keep your ${trip.title} in mind.`}
                </p>
                <div className="chat-suggestions">
                  {suggestionsFor(trip).map((suggestion) => (
                    <button key={suggestion} type="button" className="chip" onClick={() => send(suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`chat-row chat-row-${message.role === 'user' ? 'user' : 'bot'}`}>
                <div className={`chat-bubble chat-bubble-${message.role}`}>
                  {/* A placeholder answer repeats the whole prompt; leave out the trip note added to it. */}
                  {message.stub
                    ? questionOf(message.text)
                    : message.role === 'assistant'
                      ? <ChatMarkdown text={message.text} />
                      : message.text}
                  {message.stub && (
                    <span className="chat-stub">No LLM key is set, so for now I can only tell travel jokes. 😄</span>
                  )}
                  {message.role === 'error' && (
                    <button type="button" className="link-btn small" onClick={() => send(message.retry)} disabled={sending}>
                      Try again
                    </button>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="chat-row chat-row-bot">
                <div className="chat-bubble chat-bubble-assistant chat-typing" aria-label="The assistant is typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>

          <form
            className="chat-input"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={800}
              placeholder={trip ? `Ask about ${trip.destination}…` : 'Ask a travel question…'}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Your question"
            />
            <button type="submit" className="chat-send" disabled={sending || !draft.trim()} aria-label="Send">
              ➤
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`chat-launcher${open ? ' open' : ''}`}
        aria-label={open ? 'Close the AI Travel Assistant' : 'Open the AI Travel Assistant'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? '✕' : '💬'}
        {unread && !open && <span className="chat-unread" aria-hidden="true" />}
      </button>
    </>
  );
}
