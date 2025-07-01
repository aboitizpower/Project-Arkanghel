import React from 'react';
import AdminSidebar from '../../components/AdminSidebar';

const A_Modules = () => (
  <div style={{ display: 'flex', minHeight: '100vh' }}>
    <AdminSidebar />
    <main className="page-container" style={{ flex: 1 }}>
      <h1>Admin Modules</h1>
      <p>Manage modules here.</p>
    </main>
  </div>
);

export default A_Modules; 