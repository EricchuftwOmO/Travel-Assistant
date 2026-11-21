import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import LoginPage from './pages/LoginPage';
import FlightSearchPage from './pages/FlightSearchPage';
import MyTripsPage from './pages/MyTripsPage';
import TripDetailsPage from './pages/TripDetailsPage';
import ProfilePage from './pages/ProfilePage';
import ChatWidget from './components/ChatWidget';

function RequireLogin({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">✈</span> Travel Assistant
        </NavLink>
        {user && (
          <nav className="nav">
            <NavLink to="/flights">Flight Search</NavLink>
            <NavLink to="/trips">My Trips</NavLink>
          </nav>
        )}
        {user && (
          <div className="user-menu">
            <NavLink to="/profile" className="profile-link" title="My Profile">
              <span className="avatar" aria-hidden="true">{user.name.slice(0, 1)}</span>
              <span className="user-name">{user.name}</span>
            </NavLink>
            <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <>
      <Header />
      <main className="container">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/flights" element={<RequireLogin><FlightSearchPage /></RequireLogin>} />
          <Route path="/trips" element={<RequireLogin><MyTripsPage /></RequireLogin>} />
          <Route path="/trips/:tripId" element={<RequireLogin><TripDetailsPage /></RequireLogin>} />
          <Route path="/profile" element={<RequireLogin><ProfilePage /></RequireLogin>} />
          <Route path="*" element={<Navigate to="/trips" replace />} />
        </Routes>
      </main>
      {user && <ChatWidget />}
    </>
  );
}
