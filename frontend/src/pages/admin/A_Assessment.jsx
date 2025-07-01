import React from 'react';
import AdminSidebar from '../../components/AdminSidebar';

const A_Assessment = () => (
  <div style={{ display: 'flex', minHeight: '100vh' }}>
    <AdminSidebar />
    <main className="page-container" style={{ flex: 1 }}>
      <h1>Admin Assessment</h1>
      <p>Manage assessments here.</p>
    </main>
  </div>
);

export default A_Assessment; 