import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface SetupProtectedRouteProps {
  children: React.ReactElement;
}

/**
 * SetupProtectedRoute - Prevents users who have already completed setup
 * from accessing the setup page again.
 *
 * If user has completed setup, redirects to dashboard.
 * Otherwise, allows access to the setup flow.
 */
const SetupProtectedRoute: React.FC<SetupProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  // Show nothing while loading user data
  if (loading) {
    return <div>Loading...</div>;
  }

  // If user has already completed setup, redirect to dashboard
  if (user?.setup_completed_at) {
    return <Navigate to="/dashboard" replace />;
  }

  // User hasn't completed setup, allow access to setup page
  return children;
};

export default SetupProtectedRoute;
