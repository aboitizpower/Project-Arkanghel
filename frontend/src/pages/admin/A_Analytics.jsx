import React from 'react';
import AdminSidebar from '../../components/AdminSidebar';

const A_Analytics = () => (
  <div style={{ display: 'flex', minHeight: '100vh' }}>
    <AdminSidebar />
    <main className="page-container" style={{ flex: 1 }}>
      <h1>Admin Analytics</h1>
      <p>Analytics and reports for admins.</p>
    </main>
  </div>
);

export default A_Analytics; 