import React from 'react';
import EmployeeSidebar from '../../components/EmployeeSidebar';

const E_Assessment = () => (
  <div style={{ display: 'flex', minHeight: '100vh' }}>
    <EmployeeSidebar />
    <main className="page-container" style={{ flex: 1 }}>
      <h1>Employee Assessment</h1>
      <p>Take your assessments here.</p>
    </main>
  </div>
);

export default E_Assessment; 