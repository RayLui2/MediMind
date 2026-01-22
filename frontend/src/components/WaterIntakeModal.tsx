import React, { useState, useEffect } from 'react';
import * as dashboardService from '../services/dashboardService';
import '../styles/WaterIntakeModal.css';

interface WaterIntakeModalProps {
  onClose: () => void;
}

const WaterIntakeModal: React.FC<WaterIntakeModalProps> = ({ onClose }) => {
  const [recommendation, setRecommendation] = useState<dashboardService.WaterIntakeRecommendation | null>(null);
  const [todaysIntakes, setTodaysIntakes] = useState<dashboardService.WaterIntake[]>([]);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rec, intakes] = await Promise.all([
        dashboardService.getWaterIntakeRecommendation(),
        dashboardService.getWaterIntakes(1), // Today only
      ]);
      setRecommendation(rec);
      setTodaysIntakes(intakes);
      setError('');
    } catch (err: any) {
      console.error('Error fetching water intake data:', err);
      setError(err.response?.data?.detail || 'Failed to load water intake data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate today's total
  const todaysTotal = todaysIntakes.reduce((sum, intake) => sum + intake.amount_oz, 0);
  const progressPercentage = recommendation
    ? Math.min((todaysTotal / recommendation.recommended_oz) * 100, 100)
    : 0;

  // Log water intake
  const handleLogWater = async (amount: number) => {
    try {
      await dashboardService.logWaterIntake(amount);
      await fetchData(); // Refresh data
      setCustomAmount('');
    } catch (err: any) {
      console.error('Error logging water:', err);
      setError(err.response?.data?.detail || 'Failed to log water intake');
    }
  };

  // Delete water intake log
  const handleDeleteLog = async (logId: number) => {
    if (!window.confirm('Delete this water intake log?')) return;

    try {
      await dashboardService.deleteWaterIntake(logId);
      await fetchData(); // Refresh data
    } catch (err: any) {
      console.error('Error deleting water log:', err);
      setError(err.response?.data?.detail || 'Failed to delete log');
    }
  };

  // Handle custom amount submission
  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(customAmount);
    if (amount > 0 && amount <= 200) {
      handleLogWater(amount);
    }
  };

  // Format time
  const formatTime = (datetime: string) => {
    const date = new Date(datetime);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content water-intake-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Water Intake Tracker</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {loading ? (
          <div className="modal-loading">Loading...</div>
        ) : error && !recommendation ? (
          <div className="error-message">{error}</div>
        ) : (
          <>
            {/* Recommendation Section */}
            {recommendation && (
              <div className="water-recommendation">
                <h3>Daily Goal</h3>
                <div className="goal-amount">
                  <span className="amount">{recommendation.recommended_oz}</span>
                  <span className="unit">oz</span>
                  <span className="cups">({recommendation.cups} cups)</span>
                </div>
                <div className="calculation-breakdown">
                  <p>Base (weight-based): {recommendation.base_amount} oz</p>
                  <p>Activity adjustment: +{recommendation.activity_adjustment} oz</p>
                </div>
              </div>
            )}

            {/* Progress Section */}
            <div className="water-progress">
              <div className="progress-header">
                <h3>Today's Progress</h3>
                <span className="progress-text">
                  {todaysTotal.toFixed(1)} oz / {recommendation?.recommended_oz || 0} oz
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <p className="progress-percentage">{progressPercentage.toFixed(0)}% of daily goal</p>
            </div>

            {/* Quick Add Buttons */}
            <div className="quick-add-section">
              <h3>Log Water</h3>
              <div className="quick-add-buttons">
                <button onClick={() => handleLogWater(8)} className="quick-add-btn">
                  +8 oz
                  <span className="btn-subtitle">(1 cup)</span>
                </button>
                <button onClick={() => handleLogWater(16)} className="quick-add-btn">
                  +16 oz
                  <span className="btn-subtitle">(2 cups)</span>
                </button>
                <button onClick={() => handleLogWater(32)} className="quick-add-btn">
                  +32 oz
                  <span className="btn-subtitle">(4 cups)</span>
                </button>
              </div>

              <form onSubmit={handleCustomSubmit} className="custom-amount-form">
                <input
                  type="number"
                  placeholder="Custom amount (oz)"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  min="1"
                  max="200"
                  step="0.1"
                />
                <button type="submit" disabled={!customAmount || parseFloat(customAmount) <= 0}>
                  Log
                </button>
              </form>
            </div>

            {/* Today's Logs */}
            <div className="water-logs-section">
              <h3>Today's Logs</h3>
              {todaysIntakes.length === 0 ? (
                <p className="no-logs">No water logged today</p>
              ) : (
                <div className="water-logs-list">
                  {todaysIntakes.map((intake) => (
                    <div key={intake.id} className="water-log-item">
                      <div className="log-info">
                        <span className="log-amount">{intake.amount_oz} oz</span>
                        <span className="log-time">{formatTime(intake.consumed_at)}</span>
                      </div>
                      <button
                        className="log-delete-btn"
                        onClick={() => handleDeleteLog(intake.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="error-banner">{error}</div>}
          </>
        )}
      </div>
    </div>
  );
};

export default WaterIntakeModal;
