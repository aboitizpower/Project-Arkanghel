import React from 'react';
import EmployeeSidebar from '../../components/EmployeeSidebar';

const E_Modules = () => (
  <div style={{ display: 'flex', minHeight: '100vh' }}>
    <EmployeeSidebar />
    <main className="page-container" style={{ flex: 1 }}>
      <h1>Employee Modules</h1>
      <p>View and access your modules here.</p>
    </main>
  </div>
);

export default E_Modules; 