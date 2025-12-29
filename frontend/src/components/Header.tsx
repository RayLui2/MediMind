import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Header.css'

const Header: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLoginClick = () => {
    navigate('/login')
  }

  const handleChatClick = () => {
    navigate('/chat')
  }

  const handleDashboardClick = () => {
    navigate('/dashboard')
  }

  const handleHomeClick = () => {
    navigate('/')
  }

  const handleLogoutClick = () => {
    logout()
    navigate('/login')
    setShowDropdown(false)
  }

  return (
    <nav className="global-header">
      <div
        className="logo"
        onClick={handleHomeClick}
        style={{ cursor: 'pointer' }}
      >
        <div className="logo-icon">M</div>
        MediMind
      </div>
      <div className="nav-links">
        <a onClick={handleHomeClick} style={{ cursor: 'pointer' }}>
          Home
        </a>
        <a href="#about">About</a>
        <a onClick={handleChatClick} style={{ cursor: 'pointer' }}>
          Chat
        </a>
        <a onClick={handleDashboardClick} style={{ cursor: 'pointer' }}>
          Dashboard
        </a>
      </div>
      {user ? (
        <div className="user-menu" ref={dropdownRef}>
          <div
            className="user-avatar"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
          </div>

          {showDropdown && (
            <div className="user-dropdown">
              <div className="user-dropdown-header">
                <div className="user-dropdown-name">{user?.name || 'User'}</div>
                <div className="user-dropdown-email">{user?.email}</div>
              </div>
              <div className="user-dropdown-divider"></div>
              <button
                className="user-dropdown-item"
                onClick={handleLogoutClick}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      ) : (
        <button onClick={handleLoginClick} className="login-btn">
          Login
        </button>
      )}
    </nav>
  )
}

export default Header
