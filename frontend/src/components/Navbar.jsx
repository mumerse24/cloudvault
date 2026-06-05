import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, User } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">
        <div className="nav-logo">CV</div>
        <span className="nav-title">CloudVault</span>
      </Link>
      {user && (
        <div className="nav-user">
          <div className="user-profile">
            <div className="avatar">
              <User size={20} />
            </div>
            <span className="user-name">{user.name}</span>
          </div>
          <button className="btn btn-danger" onClick={handleLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
