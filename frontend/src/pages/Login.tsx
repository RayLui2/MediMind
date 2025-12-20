import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Auth.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-container">
      {/* Left Side - Branding */}
      <div className="auth-left-side">
        <div className="auth-branding">
          <div className="auth-logo">
            <div className="auth-logo-icon">M</div>
            MediMind
          </div>
        </div>

        <div className="auth-branding-content">
          <h1 className="auth-branding-title">Your AI Healthcare Companion</h1>
          <p className="auth-branding-subtitle">
            Take control of your health with personalized 
            AI-powered insights, symptom tracking, and smart health monitoring.
          </p>

          <div className="auth-features-list">
            <div className="auth-feature-item">
              <div className="auth-feature-icon">💬</div>
              <div className="auth-feature-text">
                <h4>24/7 AI Health Assistant</h4>
                <p>Get instant answers to your health questions anytime</p>
              </div>
            </div>
            <div className="auth-feature-item">
              <div className="auth-feature-icon">📊</div>
              <div className="auth-feature-text">
                <h4>Track Your Health</h4>
                <p>Monitor symptoms, medications, and vital signs in one place</p>
              </div>
            </div>
            <div className="auth-feature-item">
              <div className="auth-feature-icon">🔒</div>
              <div className="auth-feature-text">
                <h4>Secure & Private</h4>
                <p>Your health data is encrypted and protected</p>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-branding-footer">
          © 2025 MediMind. Your trusted health companion.
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="auth-right-side">
        <div className="auth-form-container">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Welcome Back!</h2>
            <p className="auth-form-subtitle">
              Don't have an account? <a href="/signup">Sign up</a>
            </p>
          </div>

          {error && <div className="auth-error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="auth-form-group">
              <label>Email <span className="auth-required">*</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="auth-form-group">
              <label>Password <span className="auth-required">*</span></label>
              <div className="auth-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
