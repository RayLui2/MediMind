import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Chart, registerables } from 'chart.js';
import '../styles/Dashboard.css';
import * as dashboardService from '../services/dashboardService';
import { filterSymptoms } from '../data/symptoms';

Chart.register(...registerables);

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Data states
  const [summary, setSummary] = useState<dashboardService.DashboardSummary | null>(null);
  const [medications, setMedications] = useState<dashboardService.Medication[]>([]);
  const [symptoms, setSymptoms] = useState<dashboardService.Symptom[]>([]);
  const [vitalSigns, setVitalSigns] = useState<dashboardService.VitalSign[]>([]);
  const [healthProfile, setHealthProfile] = useState<dashboardService.HealthProfile | null>(null);
  const [medicationsTakenToday, setMedicationsTakenToday] = useState<Set<number>>(new Set());

  // Modal states
  const [symptomModalOpen, setSymptomModalOpen] = useState(false);
  const [medicationModalOpen, setMedicationModalOpen] = useState(false);
  const [vitalSignModalOpen, setVitalSignModalOpen] = useState(false);
  const [healthProfileModalOpen, setHealthProfileModalOpen] = useState(false);

  // Form states for symptom modal
  const [symptomType, setSymptomType] = useState('');
  const [severityValue, setSeverityValue] = useState(5);
  const [symptomNotes, setSymptomNotes] = useState('');
  const [symptomSuggestions, setSymptomSuggestions] = useState<string[]>([]);
  const [showSymptomSuggestions, setShowSymptomSuggestions] = useState(false);

  // Form states for medication modal
  const [medicationName, setMedicationName] = useState('');
  const [medicationFrequency, setMedicationFrequency] = useState('');
  const [medicationTime, setMedicationTime] = useState('');
  const [medicationNotes, setMedicationNotes] = useState('');
  const [medicationSuggestions, setMedicationSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Form states for vital sign modal
  const [systolicBP, setSystolicBP] = useState('');
  const [diastolicBP, setDiastolicBP] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [weight, setWeight] = useState('');

  // Form states for health profile modal
  const [profileWeight, setProfileWeight] = useState('');
  const [profileHeight, setProfileHeight] = useState('');
  const [profileConditions, setProfileConditions] = useState('');
  const [profileAllergies, setProfileAllergies] = useState('');
  const [profileFamilyHistory, setProfileFamilyHistory] = useState('');

  // Loading state
  const [loading, setLoading] = useState(true);

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [summaryData, medsData, symptomsData, vitalsData, takenToday] = await Promise.all([
        dashboardService.getDashboardSummary(),
        dashboardService.getMedications(),
        dashboardService.getSymptoms(30),
        dashboardService.getVitalSigns(7),
        dashboardService.getTodaysMedicationLogs(),
      ]);

      setSummary(summaryData);
      setMedications(medsData);
      setSymptoms(symptomsData);
      setVitalSigns(vitalsData);
      setMedicationsTakenToday(new Set(takenToday));

      // Try to fetch health profile
      try {
        const profileData = await dashboardService.getHealthProfile();
        setHealthProfile(profileData);
      } catch (error: any) {
        if (error.response?.status === 404) {
          // No health profile yet - that's okay
          setHealthProfile(null);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Initialize Chart with real data
  useEffect(() => {
    if (!loading && chartRef.current && vitalSigns.length > 0) {
      // Small delay to ensure canvas is fully mounted
      const timeout = setTimeout(() => {
        if (!chartRef.current) return;

        const ctx = chartRef.current.getContext('2d');
        if (ctx) {
          if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
          }

          // Get last 7 vital signs
          const last7Vitals = vitalSigns.slice(0, 7).reverse();
          const labels = last7Vitals.map((v) => {
            const date = new Date(v.recorded_at);
            return date.toLocaleDateString('en-US', { weekday: 'short' });
          });
          const systolicData = last7Vitals.map((v) => v.systolic_bp || null);
          const heartRateData = last7Vitals.map((v) => v.heart_rate || null);

          chartInstanceRef.current = new Chart(ctx, {
            type: 'line',
            data: {
              labels,
              datasets: [
                {
                  label: 'Systolic BP',
                  data: systolicData,
                  borderColor: '#2E5EAA',
                  backgroundColor: 'rgba(46, 94, 170, 0.1)',
                  tension: 0.4,
                  fill: true,
                },
                {
                  label: 'Heart Rate',
                  data: heartRateData,
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
      }, 100);

      return () => {
        clearTimeout(timeout);
      };
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [vitalSigns, loading]);

  // Handle symptom type input change with autocomplete
  const handleSymptomTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSymptomType(value);

    // Filter symptoms based on input
    const filtered = filterSymptoms(value);
    setSymptomSuggestions(filtered);
    setShowSymptomSuggestions(filtered.length > 0);
  };

  // Handle selecting a symptom from suggestions
  const handleSelectSymptom = (symptom: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSymptomType(symptom);
    setShowSymptomSuggestions(false);
    setSymptomSuggestions([]);
  };

  // Close symptom suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.symptom-suggestions')) {
        return;
      }
      if (showSymptomSuggestions) {
        setShowSymptomSuggestions(false);
      }
    };

    if (showSymptomSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSymptomSuggestions]);

  // Handle adding symptom
  const handleAddSymptom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newSymptom = await dashboardService.createSymptom({
        symptom_type: symptomType,
        severity: severityValue,
        notes: symptomNotes || undefined,
      });
      setSymptomModalOpen(false);
      setSymptomType('');
      setSeverityValue(5);
      setSymptomNotes('');
      setSymptomSuggestions([]);
      setShowSymptomSuggestions(false);
      // Update only symptoms state and summary
      setSymptoms(prev => [newSymptom, ...prev]);
      const newSummary = await dashboardService.getDashboardSummary();
      setSummary(newSummary);
    } catch (error) {
      console.error('Error adding symptom:', error);
      alert('Failed to add symptom');
    }
  };

  // Search RxNorm for medication suggestions
  const searchMedications = async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setMedicationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(
        `https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search?terms=${encodeURIComponent(searchTerm)}&ef=STRENGTHS_AND_FORMS&maxList=10`
      );
      const data = await response.json();

      // Response format: [count, codes, extraData, displayStrings]
      if (data && data[3]) {
        setMedicationSuggestions(data[3]);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching medication suggestions:', error);
    }
  };

  // Debounce medication search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchMedications(medicationName);
    }, 300);

    return () => clearTimeout(timer);
  }, [medicationName]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Don't close if clicking on a suggestion
      if (target.closest('.medication-suggestions')) {
        return;
      }
      if (showSuggestions) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions]);

  // Handle medication name input change
  const handleMedicationNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMedicationName(e.target.value);
  };

  // Handle selecting a medication from suggestions
  const handleSelectSuggestion = (suggestion: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setMedicationName(suggestion);
    setShowSuggestions(false);
    setMedicationSuggestions([]);
  };

  // Handle adding medication
  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Ensure name is a string (in case it's somehow an array)
      const nameString = Array.isArray(medicationName) ? medicationName[0] : medicationName;

      const payload = {
        name: nameString,
        frequency: medicationFrequency,
        time: medicationTime || undefined,
        notes: medicationNotes || undefined,
      };
      console.log('Sending medication payload:', payload);
      const newMedication = await dashboardService.createMedication(payload);
      setMedicationModalOpen(false);
      setMedicationName('');
      setMedicationFrequency('');
      setMedicationTime('');
      setMedicationNotes('');
      setMedicationSuggestions([]);
      setShowSuggestions(false);
      // Update only medications state and summary
      setMedications(prev => [...prev, newMedication]);
      const newSummary = await dashboardService.getDashboardSummary();
      setSummary(newSummary);
    } catch (error: any) {
      console.error('Error adding medication:', error);
      console.error('Error response data:', error.response?.data);
      alert(`Failed to add medication: ${JSON.stringify(error.response?.data?.detail || error.message)}`);
    }
  };

  // Handle logging medication as taken
  const handleMedicationCheck = async (medicationId: number) => {
    // Don't allow if already taken today
    if (medicationsTakenToday.has(medicationId)) {
      return;
    }

    try {
      await dashboardService.logMedicationTaken(medicationId);
      // Optimistically update UI
      setMedicationsTakenToday(prev => new Set(prev).add(medicationId));
      // Update only summary to reflect medications taken today
      const newSummary = await dashboardService.getDashboardSummary();
      setSummary(newSummary);
    } catch (error: any) {
      console.error('Error logging medication:', error);
      if (error.response?.status === 400) {
        // Already logged today
        alert('This medication has already been logged for today');
      } else {
        alert('Failed to log medication');
      }
      // Refresh medications taken list and summary to ensure correct state
      const takenToday = await dashboardService.getTodaysMedicationLogs();
      setMedicationsTakenToday(new Set(takenToday));
      const newSummary = await dashboardService.getDashboardSummary();
      setSummary(newSummary);
    }
  };

  // Handle adding vital sign
  const handleAddVitalSign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newVitalSign = await dashboardService.createVitalSign({
        systolic_bp: systolicBP ? parseInt(systolicBP) : undefined,
        diastolic_bp: diastolicBP ? parseInt(diastolicBP) : undefined,
        heart_rate: heartRate ? parseInt(heartRate) : undefined,
        weight: weight ? parseInt(weight) : undefined,
      });
      setVitalSignModalOpen(false);
      setSystolicBP('');
      setDiastolicBP('');
      setHeartRate('');
      setWeight('');
      // Update only vital signs state and summary
      // Add new vital sign at the beginning (most recent first)
      setVitalSigns(prev => [newVitalSign, ...prev]);
      const newSummary = await dashboardService.getDashboardSummary();
      setSummary(newSummary);
    } catch (error) {
      console.error('Error adding vital sign:', error);
      alert('Failed to add vital sign');
    }
  };

  // Handle health profile update
  const handleUpdateHealthProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const profileData = {
        current_weight: profileWeight ? parseInt(profileWeight) : undefined,
        height: profileHeight ? parseInt(profileHeight) : undefined,
        current_conditions: profileConditions ? profileConditions.split(',').map((s) => s.trim()) : [],
        allergies: profileAllergies ? profileAllergies.split(',').map((s) => s.trim()) : [],
        family_history: profileFamilyHistory ? profileFamilyHistory.split(',').map((s) => s.trim()) : [],
      };

      let updatedProfile;
      if (healthProfile) {
        updatedProfile = await dashboardService.updateHealthProfile(profileData);
      } else {
        updatedProfile = await dashboardService.createHealthProfile(profileData);
      }

      setHealthProfileModalOpen(false);
      // Update only health profile state and summary (summary includes latest weight)
      setHealthProfile(updatedProfile);
      const newSummary = await dashboardService.getDashboardSummary();
      setSummary(newSummary);
    } catch (error) {
      console.error('Error updating health profile:', error);
      alert('Failed to update health profile');
    }
  };

  // Open health profile modal with existing data
  const openHealthProfileModal = () => {
    if (healthProfile) {
      setProfileWeight(healthProfile.current_weight?.toString() || '');
      setProfileHeight(healthProfile.height?.toString() || '');
      setProfileConditions(healthProfile.current_conditions.join(', '));
      setProfileAllergies(healthProfile.allergies.join(', '));
      setProfileFamilyHistory(healthProfile.family_history.join(', '));
    }
    setHealthProfileModalOpen(true);
  };

  const openCalculator = (type: string) => {
    alert(`${type.toUpperCase()} Calculator would open here. This would be a separate modal with calculator inputs.`);
  };

  const getSeverityLabel = (severity: number): string => {
    if (severity <= 3) return 'low';
    if (severity <= 6) return 'medium';
    return 'high';
  };

  const getSymptomIcon = (type: string): string => {
    const icons: { [key: string]: string } = {
      headache: '🤕',
      fatigue: '😴',
      fever: '🤒',
      cough: '😷',
      nausea: '🤢',
      pain: '😣',
    };
    return icons[type] || '🩹';
  };

  if (loading) {
    return <div className="dashboard-page">Loading...</div>;
  }

  return (
    <div className="dashboard-page">
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
            <div className="stat-value">
              {summary?.medications_today || 0}/{summary?.total_medications || 0}
            </div>
            <div className="stat-label">Medications Today</div>
            <div className="stat-change positive">
              {summary && summary.medications_today >= summary.total_medications ? '✓ Complete' : '↑ On track'}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon green">❤️</div>
            </div>
            <div className="stat-value">{summary?.latest_bp || '--/--'}</div>
            <div className="stat-label">Blood Pressure (mmHg)</div>
            <div className="stat-change positive">Latest reading</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon orange">⚖️</div>
            </div>
            <div className="stat-value">{summary?.latest_weight ? `${summary.latest_weight} lbs` : '--'}</div>
            <div className="stat-label">Current Weight</div>
            <div className="stat-change positive">Latest reading</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon cyan">🔥</div>
            </div>
            <div className="stat-value">{summary?.active_streak_days || 0}</div>
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
                <span className="card-action" onClick={() => setVitalSignModalOpen(true)}>
                  + Add Reading
                </span>
              </div>
              <div className="chart-container">
                {vitalSigns.length > 0 ? (
                  <canvas ref={chartRef}></canvas>
                ) : (
                  <p style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                    No vital signs recorded yet. Click "+ Add Reading" to start tracking!
                  </p>
                )}
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
                {symptoms.length > 0 ? (
                  symptoms.slice(0, 5).map((symptom) => (
                    <div key={symptom.id} className="symptom-item">
                      <div className="symptom-info">
                        <div className="symptom-icon">{getSymptomIcon(symptom.symptom_type)}</div>
                        <div className="symptom-details">
                          <h4>{symptom.symptom_type.charAt(0).toUpperCase() + symptom.symptom_type.slice(1)}</h4>
                          <span className="symptom-time">
                            {new Date(symptom.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <span className={`severity-badge ${getSeverityLabel(symptom.severity)}`}>
                        {getSeverityLabel(symptom.severity)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>
                    No symptoms logged yet
                  </p>
                )}
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
                {medications.length > 0 ? (
                  medications.map((medication) => (
                    <div key={medication.id} className="medication-item">
                      <div className="medication-info">
                        <div className="medication-icon">💊</div>
                        <div className="medication-details">
                          <h4>{medication.name}</h4>
                          <span className="medication-time">
                            {medication.time || ''} {medication.frequency}
                          </span>
                        </div>
                      </div>
                      <button
                        className={`check-btn ${medicationsTakenToday.has(medication.id) ? 'checked' : ''}`}
                        onClick={() => handleMedicationCheck(medication.id)}
                        disabled={medicationsTakenToday.has(medication.id)}
                      >
                        {medicationsTakenToday.has(medication.id) ? '✓' : '○'}
                      </button>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>
                    No medications added yet
                  </p>
                )}
              </div>
            </div>

            {/* Health Profile */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Health Profile</h3>
                <span className="card-action" onClick={openHealthProfileModal}>
                  {healthProfile ? 'Edit' : 'Create'}
                </span>
              </div>
              {healthProfile ? (
                <>
                  <div className="profile-section">
                    <h4>Current Conditions</h4>
                    <div className="profile-tags">
                      {healthProfile.current_conditions.length > 0 ? (
                        healthProfile.current_conditions.map((condition, idx) => (
                          <span key={idx} className="profile-tag">
                            {condition}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#666' }}>None listed</span>
                      )}
                    </div>
                  </div>
                  <div className="profile-section">
                    <h4>Allergies</h4>
                    <div className="profile-tags">
                      {healthProfile.allergies.length > 0 ? (
                        healthProfile.allergies.map((allergy, idx) => (
                          <span key={idx} className="profile-tag">
                            {allergy}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#666' }}>None listed</span>
                      )}
                    </div>
                  </div>
                  <div className="profile-section">
                    <h4>Family History</h4>
                    <div className="profile-tags">
                      {healthProfile.family_history.length > 0 ? (
                        healthProfile.family_history.map((history, idx) => (
                          <span key={idx} className="profile-tag">
                            {history}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#666' }}>None listed</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>
                  Create your health profile to get started
                </p>
              )}
            </div>

            {/* AI Recommendations */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">AI Recommendations</h3>
              </div>
              <div className="recommendations-list">
                <div className="recommendation-item">
                  <h5>💪 Increase Physical Activity</h5>
                  <p>Based on your weight goals, try adding 15 minutes of walking daily.</p>
                </div>
                <div className="recommendation-item">
                  <h5>😴 Improve Sleep Schedule</h5>
                  <p>Your symptom patterns suggest inconsistent sleep. Aim for 7-8 hours nightly.</p>
                </div>
                <div className="recommendation-item">
                  <h5>💧 Hydration Reminder</h5>
                  <p>Drink at least 8 glasses of water daily to help with headaches.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Symptom Modal */}
      {symptomModalOpen && (
        <div
          className="modal active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSymptomModalOpen(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Log Symptom</h3>
              <button className="close-btn" onClick={() => setSymptomModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddSymptom}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Symptom Type</label>
                <input
                  type="text"
                  placeholder="Start typing symptom..."
                  required
                  value={symptomType}
                  onChange={handleSymptomTypeChange}
                  onFocus={() => symptomSuggestions.length > 0 && setShowSymptomSuggestions(true)}
                />
                {showSymptomSuggestions && symptomSuggestions.length > 0 && (
                  <div
                    className="symptom-suggestions"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                  >
                    {symptomSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        onClick={(e) => handleSelectSymptom(suggestion, e)}
                        style={{
                          padding: '10px 15px',
                          cursor: 'pointer',
                          borderBottom: index < symptomSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
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
                <textarea
                  rows={3}
                  placeholder="Any additional details..."
                  value={symptomNotes}
                  onChange={(e) => setSymptomNotes(e.target.value)}
                ></textarea>
              </div>
              <button type="submit" className="submit-btn">
                Log Symptom
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Medication Modal */}
      {medicationModalOpen && (
        <div
          className="modal active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMedicationModalOpen(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Add Medication</h3>
              <button className="close-btn" onClick={() => setMedicationModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddMedication}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Medication Name</label>
                <input
                  type="text"
                  placeholder="e.g., Aspirin 81mg"
                  required
                  value={medicationName}
                  onChange={handleMedicationNameChange}
                  onFocus={() => medicationSuggestions.length > 0 && setShowSuggestions(true)}
                />
                {showSuggestions && medicationSuggestions.length > 0 && (
                  <div
                    className="medication-suggestions"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                  >
                    {medicationSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        onClick={(e) => handleSelectSuggestion(suggestion, e)}
                        style={{
                          padding: '10px 15px',
                          cursor: 'pointer',
                          borderBottom: index < medicationSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Frequency</label>
                <select
                  required
                  value={medicationFrequency}
                  onChange={(e) => setMedicationFrequency(e.target.value)}
                >
                  <option value="">Select frequency</option>
                  <option value="daily">Daily</option>
                  <option value="twice">Twice daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="asneeded">As needed</option>
                </select>
              </div>
              <div className="form-group">
                <label>Time</label>
                <input
                  type="time"
                  value={medicationTime}
                  onChange={(e) => setMedicationTime(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Instructions, reminders..."
                  value={medicationNotes}
                  onChange={(e) => setMedicationNotes(e.target.value)}
                ></textarea>
              </div>
              <button type="submit" className="submit-btn">
                Add Medication
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Vital Sign Modal */}
      {vitalSignModalOpen && (
        <div
          className="modal active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setVitalSignModalOpen(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Log Vital Signs</h3>
              <button className="close-btn" onClick={() => setVitalSignModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddVitalSign}>
              <div className="form-group">
                <label>Blood Pressure (Systolic)</label>
                <input
                  type="number"
                  placeholder="e.g., 120"
                  value={systolicBP}
                  onChange={(e) => setSystolicBP(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Blood Pressure (Diastolic)</label>
                <input
                  type="number"
                  placeholder="e.g., 80"
                  value={diastolicBP}
                  onChange={(e) => setDiastolicBP(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Heart Rate (bpm)</label>
                <input
                  type="number"
                  placeholder="e.g., 72"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Weight (lbs)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="e.g., 165"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
              <button type="submit" className="submit-btn">
                Log Vital Signs
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Health Profile Modal */}
      {healthProfileModalOpen && (
        <div
          className="modal active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHealthProfileModalOpen(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{healthProfile ? 'Edit' : 'Create'} Health Profile</h3>
              <button className="close-btn" onClick={() => setHealthProfileModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleUpdateHealthProfile}>
              <div className="form-group">
                <label>Current Weight (lbs)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="e.g., 165"
                  value={profileWeight}
                  onChange={(e) => setProfileWeight(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Height (inches)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="e.g., 68"
                  value={profileHeight}
                  onChange={(e) => setProfileHeight(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Current Conditions (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., Hypertension, Type 2 Diabetes"
                  value={profileConditions}
                  onChange={(e) => setProfileConditions(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Allergies (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., Penicillin, Peanuts"
                  value={profileAllergies}
                  onChange={(e) => setProfileAllergies(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Family History (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., Heart Disease, Diabetes"
                  value={profileFamilyHistory}
                  onChange={(e) => setProfileFamilyHistory(e.target.value)}
                />
              </div>
              <button type="submit" className="submit-btn">
                {healthProfile ? 'Update' : 'Create'} Profile
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
