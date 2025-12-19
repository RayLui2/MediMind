import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Signup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;

    if (strength <= 1) return { level: 'Weak', className: 'weak' };
    if (strength <= 3) return { level: 'Medium', className: 'medium' };
    return { level: 'Strong', className: 'strong' };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signup(
        email,
        password,
        name || undefined,
        age ? parseInt(age) : undefined
      );
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Signup failed. Please try again.');
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
            <h2 className="auth-form-title">Create Account</h2>
            <p className="auth-form-subtitle">
              Already have an account? <a href="/login">Login</a>
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
                  placeholder="Create a strong password"
                  minLength={8}
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
              {password && (
                <div className="auth-password-strength">
                  <div className="auth-strength-bar">
                    <div className={`auth-strength-fill ${passwordStrength.className}`}></div>
                  </div>
                  <div className="auth-strength-text">
                    Password strength: <span className={passwordStrength.className}>{passwordStrength.level}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="auth-form-group">
              <label>Name (Optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>

            <div className="auth-form-group">
              <label>Age (Optional)</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Enter your age"
                min="1"
                max="150"
              />
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;
