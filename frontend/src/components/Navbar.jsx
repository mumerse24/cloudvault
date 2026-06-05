import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Search, Bell } from 'lucide-react';

const Navbar = ({ searchQuery, setSearchQuery, notificationsCount = 0, onNotificationsClick }) => {
  const { user } = useAuth();

  return (
    <header className="app-navbar">
      {setSearchQuery !== undefined ? (
        <div className="search-container">
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="search-input"
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      ) : (
        <div style={{ flex: 1 }} />
      )}

      <div className="navbar-right">
        {user && (
          <>
            <button 
              className="notifications-trigger" 
              onClick={onNotificationsClick}
              title="Real-time Notifications"
              style={{ padding: '0.5rem', borderRadius: '8px', transition: 'var(--transition-smooth)' }}
            >
              < Bell size={20} />
              {notificationsCount > 0 && <span className="notification-badge" />}
            </button>
            <div className="user-profile-widget">
              <div className="user-avatar" title={user.email}>
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <span className="user-name" style={{ fontWeight: 600, fontSize: '0.95rem' }}>{user.name}</span>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;
