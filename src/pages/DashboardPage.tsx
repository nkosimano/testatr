import React from 'react';
import { Dashboard } from '../components/dashboard/Dashboard';
import { useAuthStore } from '../stores/authStore';
import { useMatchStore } from '../stores/matchStore';
import { useEffect } from 'react';

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { fetchMatches } = useMatchStore();
  
  useEffect(() => {
    if (user) {
      fetchMatches(user.id);
    }
  }, [user, fetchMatches]);
  
  return (
    <Dashboard />
  );
};

export default DashboardPage;