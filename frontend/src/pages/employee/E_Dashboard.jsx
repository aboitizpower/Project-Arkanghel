import React from 'react';
import EmployeeSidebar from '../../components/EmployeeSidebar';

const E_Dashboard = () => (
  <div style={{ display: 'flex', minHeight: '100vh' }}>
    <EmployeeSidebar />
    <main className="page-container" style={{ flex: 1 }}>
      <h1>Employee Dashboard</h1>
      <p>Welcome to your dashboard.</p>
    </main>
  </div>
);

export default E_Dashboard;
