import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import './Dashboard.css'

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Welcome to MediMind</h1>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>

      <div className="dashboard-content">
        <div className="user-card">
          <h2>Your Profile</h2>
          <div className="user-info">
            <p>
              <strong>Email:</strong> {user?.email}
            </p>
            <p>
              <strong>Name:</strong> {user?.name || 'Not provided'}
            </p>
            <p>
              <strong>Age:</strong> {user?.age || 'Not provided'}
            </p>
            <p>
              <strong>Member since:</strong>{' '}
              {new Date(user?.created_at || '').toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <h3>💬 AI Chat</h3>
            <p>Ask health questions and get instant answers</p>
            <button className="feature-button">Coming Soon</button>
          </div>

          <div className="feature-card">
            <h3>📊 Health Dashboard</h3>
            <p>Track your symptoms and vital signs</p>
            <button className="feature-button">Coming Soon</button>
          </div>

          <div className="feature-card">
            <h3>💊 Medications</h3>
            <p>Manage medication reminders</p>
            <button className="feature-button">Coming Soon</button>
          </div>

          <div className="feature-card">
            <h3>📝 History</h3>
            <p>View your conversation history</p>
            <button className="feature-button">Coming Soon</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
