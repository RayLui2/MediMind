import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Chart, registerables } from 'chart.js';
import '../styles/Dashboard.css';

Chart.register(...registerables);

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Modal states
  const [symptomModalOpen, setSymptomModalOpen] = useState(false);
  const [medicationModalOpen, setMedicationModalOpen] = useState(false);
  const [severityValue, setSeverityValue] = useState(5);

  // Medication check states
  const [medicationChecks, setMedicationChecks] = useState([true, true, false]);

  // Initialize Chart
  useEffect(() => {
    if (chartRef.current) {
      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        // Destroy existing chart if it exists
        if (chartInstanceRef.current) {
          chartInstanceRef.current.destroy();
        }

        chartInstanceRef.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [
              {
                label: 'Systolic BP',
                data: [125, 122, 118, 120, 118, 117, 118],
                borderColor: '#2E5EAA',
                backgroundColor: 'rgba(46, 94, 170, 0.1)',
                tension: 0.4,
                fill: true,
              },
              {
                label: 'Heart Rate',
                data: [72, 75, 70, 73, 71, 69, 72],
                borderColor: '#5DD3C6',
                backgroundColor: 'rgba(93, 211, 198, 0.1)',
                tension: 0.4,
                fill: true,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
              },
            },
            scales: {
              y: {
                beginAtZero: false,
              },
            },
          },
        });
      }
    }

    // Cleanup
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, []);

  const handleAddSymptom = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Symptom logged successfully! In production, this would save to the database.');
    setSymptomModalOpen(false);
  };

  const handleAddMedication = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Medication added successfully! In production, this would save to the database.');
    setMedicationModalOpen(false);
  };

  const toggleMedicationCheck = (index: number) => {
    const newChecks = [...medicationChecks];
    newChecks[index] = !newChecks[index];
    setMedicationChecks(newChecks);
  };

  const openCalculator = (type: string) => {
    alert(`${type.toUpperCase()} Calculator would open here. This would be a separate modal with calculator inputs.`);
  };

  const getUserInitials = () => {
    if (user?.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || 'U';
  };

  return (
    <div className="dashboard-page">
      {/* Dashboard Container */}
      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <h1 className="dashboard-title">Personal Health Dashboard</h1>
          <p className="dashboard-subtitle">
            Track your health, monitor symptoms, and get personalized insights
          </p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon blue">💊</div>
            </div>
            <div className="stat-value">4/5</div>
            <div className="stat-label">Medications Today</div>
            <div className="stat-change positive">↑ On track</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon green">❤️</div>
            </div>
            <div className="stat-value">118/78</div>
            <div className="stat-label">Blood Pressure (mmHg)</div>
            <div className="stat-change positive">↓ 2% from last week</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon orange">⚖️</div>
            </div>
            <div className="stat-value">165 lbs</div>
            <div className="stat-label">Current Weight</div>
            <div className="stat-change positive">↓ 3 lbs this month</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon cyan">🔥</div>
            </div>
            <div className="stat-value">7</div>
            <div className="stat-label">Day Streak</div>
            <div className="stat-change positive">↑ Keep it up!</div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="main-grid">
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Vital Signs Chart */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Vital Signs Trends</h3>
                <span className="card-action">Last 7 days</span>
              </div>
              <div className="chart-container">
                <canvas ref={chartRef}></canvas>
              </div>
            </div>

            {/* Symptom Tracker */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Symptom Tracker</h3>
                <span className="card-action" onClick={() => setSymptomModalOpen(true)}>
                  + Add Symptom
                </span>
              </div>
              <div className="symptom-list">
                <div className="symptom-item">
                  <div className="symptom-info">
                    <div className="symptom-icon">🤕</div>
                    <div className="symptom-details">
                      <h4>Headache</h4>
                      <span className="symptom-time">Today, 2:30 PM</span>
                    </div>
                  </div>
                  <span className="severity-badge medium">Medium</span>
                </div>
                <div className="symptom-item">
                  <div className="symptom-info">
                    <div className="symptom-icon">😴</div>
                    <div className="symptom-details">
                      <h4>Fatigue</h4>
                      <span className="symptom-time">Today, 10:00 AM</span>
                    </div>
                  </div>
                  <span className="severity-badge low">Low</span>
                </div>
                <div className="symptom-item">
                  <div className="symptom-info">
                    <div className="symptom-icon">🤒</div>
                    <div className="symptom-details">
                      <h4>Mild Fever</h4>
                      <span className="symptom-time">Yesterday, 8:00 PM</span>
                    </div>
                  </div>
                  <span className="severity-badge low">Low</span>
                </div>
              </div>
            </div>

            {/* Health Calculators */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Health Calculators</h3>
              </div>
              <div className="calculator-grid">
                <div className="calculator-card" onClick={() => openCalculator('risk')}>
                  <div className="calculator-icon">⚠️</div>
                  <div className="calculator-name">Health Risk</div>
                </div>
                <div className="calculator-card" onClick={() => openCalculator('bmi')}>
                  <div className="calculator-icon">📏</div>
                  <div className="calculator-name">BMI Calculator</div>
                </div>
                <div className="calculator-card" onClick={() => openCalculator('bmr')}>
                  <div className="calculator-icon">🔥</div>
                  <div className="calculator-name">BMR Calculator</div>
                </div>
                <div className="calculator-card" onClick={() => openCalculator('water')}>
                  <div className="calculator-icon">💧</div>
                  <div className="calculator-name">Water Intake</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Medication Reminders */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Medications</h3>
                <span className="card-action" onClick={() => setMedicationModalOpen(true)}>
                  + Add
                </span>
              </div>
              <div className="medication-list">
                <div className="medication-item">
                  <div className="medication-info">
                    <div className="medication-icon">💊</div>
                    <div className="medication-details">
                      <h4>Aspirin 81mg</h4>
                      <span className="medication-time">8:00 AM daily</span>
                    </div>
                  </div>
                  <button
                    className={`check-btn ${medicationChecks[0] ? 'checked' : ''}`}
                    onClick={() => toggleMedicationCheck(0)}
                  >
                    {medicationChecks[0] ? '✓' : '○'}
                  </button>
                </div>
                <div className="medication-item">
                  <div className="medication-info">
                    <div className="medication-icon">💊</div>
                    <div className="medication-details">
                      <h4>Vitamin D</h4>
                      <span className="medication-time">12:00 PM daily</span>
                    </div>
                  </div>
                  <button
                    className={`check-btn ${medicationChecks[1] ? 'checked' : ''}`}
                    onClick={() => toggleMedicationCheck(1)}
                  >
                    {medicationChecks[1] ? '✓' : '○'}
                  </button>
                </div>
                <div className="medication-item">
                  <div className="medication-info">
                    <div className="medication-icon">💊</div>
                    <div className="medication-details">
                      <h4>Omega-3</h4>
                      <span className="medication-time">8:00 PM daily</span>
                    </div>
                  </div>
                  <button
                    className={`check-btn ${medicationChecks[2] ? 'checked' : ''}`}
                    onClick={() => toggleMedicationCheck(2)}
                  >
                    {medicationChecks[2] ? '✓' : '○'}
                  </button>
                </div>
              </div>
            </div>

            {/* Health Profile */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Health Profile</h3>
                <span
                  className="card-action"
                  onClick={() => alert('Edit Profile feature coming soon!')}
                >
                  Edit
                </span>
              </div>
              <div className="profile-section">
                <h4>Current Conditions</h4>
                <div className="profile-tags">
                  <span className="profile-tag">Hypertension</span>
                  <span className="profile-tag">Type 2 Diabetes</span>
                </div>
              </div>
              <div className="profile-section">
                <h4>Allergies</h4>
                <div className="profile-tags">
                  <span className="profile-tag">Penicillin</span>
                  <span className="profile-tag">Peanuts</span>
                </div>
              </div>
              <div className="profile-section">
                <h4>Family History</h4>
                <div className="profile-tags">
                  <span className="profile-tag">Heart Disease</span>
                  <span className="profile-tag">Diabetes</span>
                </div>
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">AI Recommendations</h3>
              </div>
              <div className="recommendations-list">
                <div className="recommendation-item">
                  <h5>💪 Increase Physical Activity</h5>
                  <p>
                    Based on your weight goals, try adding 15 minutes of walking daily.
                  </p>
                </div>
                <div className="recommendation-item">
                  <h5>😴 Improve Sleep Schedule</h5>
                  <p>
                    Your symptom patterns suggest inconsistent sleep. Aim for 7-8 hours nightly.
                  </p>
                </div>
                <div className="recommendation-item">
                  <h5>💧 Hydration Reminder</h5>
                  <p>
                    Drink at least 8 glasses of water daily to help with headaches.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Symptom Modal */}
      {symptomModalOpen && (
        <div className="modal active" onClick={(e) => {
          if (e.target === e.currentTarget) setSymptomModalOpen(false);
        }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Log Symptom</h3>
              <button className="close-btn" onClick={() => setSymptomModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleAddSymptom}>
              <div className="form-group">
                <label>Symptom Type</label>
                <select required>
                  <option value="">Select symptom</option>
                  <option value="headache">Headache</option>
                  <option value="fatigue">Fatigue</option>
                  <option value="fever">Fever</option>
                  <option value="cough">Cough</option>
                  <option value="nausea">Nausea</option>
                  <option value="pain">Pain</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Severity (1-10)</label>
                <div className="slider-container">
                  <input
                    type="range"
                    className="slider"
                    min="1"
                    max="10"
                    value={severityValue}
                    onChange={(e) => setSeverityValue(Number(e.target.value))}
                  />
                  <span className="slider-value">{severityValue}</span>
                </div>
              </div>
              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea rows={3} placeholder="Any additional details..."></textarea>
              </div>
              <button type="submit" className="submit-btn">Log Symptom</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Medication Modal */}
      {medicationModalOpen && (
        <div className="modal active" onClick={(e) => {
          if (e.target === e.currentTarget) setMedicationModalOpen(false);
        }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Add Medication</h3>
              <button className="close-btn" onClick={() => setMedicationModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleAddMedication}>
              <div className="form-group">
                <label>Medication Name</label>
                <input type="text" placeholder="e.g., Aspirin 81mg" required />
              </div>
              <div className="form-group">
                <label>Frequency</label>
                <select required>
                  <option value="">Select frequency</option>
                  <option value="daily">Daily</option>
                  <option value="twice">Twice daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="asneeded">As needed</option>
                </select>
              </div>
              <div className="form-group">
                <label>Time</label>
                <input type="time" required />
              </div>
              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea rows={2} placeholder="Instructions, reminders..."></textarea>
              </div>
              <button type="submit" className="submit-btn">Add Medication</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

