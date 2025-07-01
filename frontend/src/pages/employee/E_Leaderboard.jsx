import React from 'react';
import EmployeeSidebar from '../../components/EmployeeSidebar';

const E_Leaderboard = () => (
  <div style={{ display: 'flex', minHeight: '100vh' }}>
    <EmployeeSidebar />
    <main className="page-container" style={{ flex: 1 }}>
      <h1>Employee Leaderboard</h1>
      <p>See your ranking among employees.</p>
    </main>
  </div>
);

export default E_Leaderboard; 