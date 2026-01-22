import React, { useState } from 'react';
import { completeSetup } from '../services/dashboardService';
import { useAuth } from '../context/AuthContext';
import '../styles/SetupFlow.css';

const SetupFlow: React.FC = () => {
  const { user } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    weight: '',
    heightFeet: '',
    heightInches: '',
    activityLevel: 'sedentary',
    conditions: '',
    allergies: '',
    familyHistory: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear validation error when user types
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const { [name]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Weight validation
    if (formData.weight) {
      const weight = parseInt(formData.weight);
      if (isNaN(weight) || weight < 50 || weight > 500) {
        errors.weight = 'Weight must be between 50 and 500 lbs';
      }
    }

    // Height validation
    if (formData.heightFeet || formData.heightInches) {
      const feet = parseInt(formData.heightFeet) || 0;
      const inches = parseInt(formData.heightInches) || 0;
      const totalInches = feet * 12 + inches;

      if (totalInches < 36 || totalInches > 96) {
        errors.height = 'Height must be between 3\'0" and 8\'0"';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Convert height to inches
      const feet = parseInt(formData.heightFeet) || 0;
      const inches = parseInt(formData.heightInches) || 0;
      const totalHeight = feet * 12 + inches;

      // Parse comma-separated arrays
      const parseArray = (str: string) => {
        if (!str.trim()) return [];
        return str
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      };

      const setupData = {
        current_weight: formData.weight ? parseInt(formData.weight) : undefined,
        height: totalHeight > 0 ? totalHeight : undefined,
        activity_level: formData.activityLevel,
        current_conditions: parseArray(formData.conditions),
        allergies: parseArray(formData.allergies),
        family_history: parseArray(formData.familyHistory),
      };

      await completeSetup(setupData);

      // Reload the page to refresh user data with setup_completed_at
      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error('Setup error:', err);
      setError(err.response?.data?.detail || 'Failed to complete setup. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="setup-container">
      <div className="setup-content">
        <div className="setup-header">
          <h1>Welcome to MediMind{user?.name ? `, ${user.name}` : ''}!</h1>
          <p>Let's set up your health profile to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="setup-form">
          {/* Physical Metrics Section */}
          <div className="form-section">
            <h2>Physical Metrics</h2>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="weight">Weight (lbs)</label>
                <input
                  type="number"
                  id="weight"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="e.g., 150"
                  min="50"
                  max="500"
                  className={validationErrors.weight ? 'error' : ''}
                />
                {validationErrors.weight && (
                  <span className="error-message">{validationErrors.weight}</span>
                )}
              </div>

              <div className="form-group">
                <label>Height</label>
                <div className="height-inputs">
                  <input
                    type="number"
                    name="heightFeet"
                    value={formData.heightFeet}
                    onChange={handleChange}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="Feet"
                    min="3"
                    max="8"
                    className={validationErrors.height ? 'error' : ''}
                  />
                  <span className="height-separator">ft</span>
                  <input
                    type="number"
                    name="heightInches"
                    value={formData.heightInches}
                    onChange={handleChange}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="Inches"
                    min="0"
                    max="11"
                    className={validationErrors.height ? 'error' : ''}
                  />
                  <span className="height-separator">in</span>
                </div>
                {validationErrors.height && (
                  <span className="error-message">{validationErrors.height}</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="activityLevel">Activity Level</label>
              <select
                id="activityLevel"
                name="activityLevel"
                value={formData.activityLevel}
                onChange={handleChange}
              >
                <option value="sedentary">Sedentary (little/no exercise)</option>
                <option value="lightly_active">Lightly Active (1-3 days/week)</option>
                <option value="moderately_active">Moderately Active (3-5 days/week)</option>
                <option value="very_active">Very Active (6-7 days/week)</option>
                <option value="extremely_active">Extremely Active (physical job + exercise)</option>
              </select>
              <span className="field-hint">Used to calculate daily water intake recommendation</span>
            </div>
          </div>

          {/* Medical Information Section */}
          <div className="form-section">
            <h2>Medical Information</h2>
            <p className="section-description">
              Separate multiple items with commas (e.g., "Hypertension, Type 2 Diabetes")
            </p>

            <div className="form-group">
              <label htmlFor="conditions">Current Conditions</label>
              <textarea
                id="conditions"
                name="conditions"
                value={formData.conditions}
                onChange={handleChange}
                placeholder="e.g., Hypertension, Type 2 Diabetes, Asthma"
                rows={2}
              />
            </div>

            <div className="form-group">
              <label htmlFor="allergies">Allergies</label>
              <textarea
                id="allergies"
                name="allergies"
                value={formData.allergies}
                onChange={handleChange}
                placeholder="e.g., Penicillin, Peanuts, Shellfish"
                rows={2}
              />
            </div>

            <div className="form-group">
              <label htmlFor="familyHistory">Family History</label>
              <textarea
                id="familyHistory"
                name="familyHistory"
                value={formData.familyHistory}
                onChange={handleChange}
                placeholder="e.g., Heart Disease, Diabetes, Cancer"
                rows={2}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && <div className="error-banner">{error}</div>}

          {/* Submit Button */}
          <button type="submit" className="setup-submit-btn" disabled={loading}>
            {loading ? 'Setting up...' : 'Complete Setup'}
          </button>

          <p className="setup-note">
            You can update your profile anytime from the dashboard
          </p>
        </form>
      </div>
    </div>
  );
};

export default SetupFlow;
