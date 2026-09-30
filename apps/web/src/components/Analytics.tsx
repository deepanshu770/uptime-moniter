import React from 'react';
import { ApiMonitoringDashboard } from './api-dashboard/ApiMonitoringDashboard';
import { Monitor } from '../types';

export const Analytics: React.FC<{ monitors: Monitor[] }> = ({ monitors }) => {
  return <ApiMonitoringDashboard monitors={monitors} />;
};
