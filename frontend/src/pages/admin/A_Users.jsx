import React from 'react';
import AdminSidebar from '../../components/AdminSidebar';

const A_Users = () => (
  <div style={{ display: 'flex', minHeight: '100vh' }}>
    <AdminSidebar />
    <main className="page-container" style={{ flex: 1 }}>
      <h1>Admin Users</h1>
      <p>Manage users here.</p>
    </main>
  </div>
);

export default A_Users; 