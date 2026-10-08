'use client';

import React from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ParticipantDashboard } from '@/components/dashboard/ParticipantDashboard';
import { JudgeDashboardOverview } from '@/components/dashboard/JudgeDashboardOverview';
import { AdminDashboardOverview } from '@/components/dashboard/AdminDashboardOverview';
import { DashboardSkeleton } from '@/components/dashboard/SkeletonLoaders';

export default function DashboardPage() {
  const { role, loading } = useAuth();

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (role === 'admin') {
    return <AdminDashboardOverview />;
  }

  if (role === 'judge') {
    return <JudgeDashboardOverview />;
  }

  return <ParticipantDashboard />;
}
