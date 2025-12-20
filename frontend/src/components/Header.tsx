import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Header.css';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleChatClick = () => {
    navigate('/chat');
  };

  const handleDashboardClick = () => {
    navigate('/dashboard');
  };

  const handleHomeClick = () => {
    navigate('/');
  };

  const handleLogoutClick = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="global-header">
      <div className="logo" onClick={handleHomeClick} style={{ cursor: 'pointer' }}>
        <div className="logo-icon">M</div>
        MediMind
      </div>
      <div className="nav-links">
        <a onClick={handleHomeClick} style={{ cursor: 'pointer' }}>Home</a>
        <a href="#about">About</a>
        <a onClick={handleChatClick} style={{ cursor: 'pointer' }}>Chat</a>
        <a onClick={handleDashboardClick} style={{ cursor: 'pointer' }}>Dashboard</a>
      </div>
      {user ? (
        <button onClick={handleLogoutClick} className="login-btn">
          Logout
        </button>
      ) : (
        <button onClick={handleLoginClick} className="login-btn">
          Login
        </button>
      )}
    </nav>
  );
};

export default Header;
