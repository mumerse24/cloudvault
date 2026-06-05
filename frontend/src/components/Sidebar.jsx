import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  HardDrive,
  Star,
  Trash2,
  History,
  Shield,
  Sun,
  Moon,
  LogOut,
  Cloud,
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Helper to format bytes to MB
  const formatQuota = (bytes) => {
    if (!bytes) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const storageUsed = user?.storageUsed || 0;
  const storageLimit = user?.storageLimit || 100 * 1024 * 1024; // 100MB fallback
  const storagePercent = Math.min(100, (storageUsed / storageLimit) * 100);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="app-sidebar">
      <div>
        <NavLink to="/" className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Cloud size={20} fill="currentColor" />
          </div>
          <span className="sidebar-logo-text">CloudVault</span>
        </NavLink>

        <nav className="sidebar-menu">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `sidebar-item-link ${isActive ? 'active' : ''}`
            }
          >
            <HardDrive size={18} />
            <span>My Drive</span>
          </NavLink>

          <NavLink
            to="/starred"
            className={({ isActive }) =>
              `sidebar-item-link ${isActive ? 'active' : ''}`
            }
          >
            <Star size={18} />
            <span>Starred</span>
          </NavLink>

          <NavLink
            to="/trash"
            className={({ isActive }) =>
              `sidebar-item-link ${isActive ? 'active' : ''}`
            }
          >
            <Trash2 size={18} />
            <span>Trash Bin</span>
          </NavLink>

          <NavLink
            to="/activity"
            className={({ isActive }) =>
              `sidebar-item-link ${isActive ? 'active' : ''}`
            }
          >
            <History size={18} />
            <span>Activity Log</span>
          </NavLink>

          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `sidebar-item-link ${isActive ? 'active' : ''}`
              }
            >
              <Shield size={18} />
              <span>Admin Panel</span>
            </NavLink>
          )}
        </nav>
      </div>

      <div className="sidebar-footer">
        {/* Storage Widget */}
        <div className="storage-widget">
          <div className="storage-header">
            <span>Storage</span>
            <span>{storagePercent.toFixed(0)}% used</span>
          </div>
          <div className="storage-progress-bg">
            <div
              className="storage-progress-fill"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <div style={{ marginTop: '0.4rem', color: 'var(--text-muted)' }}>
            {formatQuota(storageUsed)} of {formatQuota(storageLimit)}
          </div>
        </div>

        {/* Theme Toggle Widget */}
        <div className="theme-toggle-widget">
          <span className="theme-toggle-label">
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Switch theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* Logout */}
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
