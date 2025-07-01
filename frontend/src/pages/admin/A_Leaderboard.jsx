import React from 'react';
import AdminSidebar from '../../components/AdminSidebar';

const A_Leaderboard = () => (
  <div style={{ display: 'flex', minHeight: '100vh' }}>
    <AdminSidebar />
    <main className="page-container" style={{ flex: 1 }}>
      <h1>Admin Leaderboard</h1>
      <p>Leaderboard for admins.</p>
    </main>
  </div>
);

export default A_Leaderboard; 