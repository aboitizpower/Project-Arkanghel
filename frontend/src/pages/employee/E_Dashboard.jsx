import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_Dashboard.css'; // New CSS file
import { FaCheckCircle, FaHourglassHalf } from 'react-icons/fa';

const API_URL = 'http://localhost:8081';

const E_Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({ kpis: {}, workstreams: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const userId = localStorage.getItem('userId');

  useEffect(() => {
    if (userId) {
      const fetchDashboardData = async () => {
        try {
          const response = await axios.get(`${API_URL}/employee/dashboard/${userId}`);
          setDashboardData(response.data);
        } catch (err) {
          setError('Failed to fetch dashboard data.');
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchDashboardData();
    } else {
      setError('You must be logged in to view this page.');
      setLoading(false);
    }
  }, [userId]);

  return (
    <div className="employee-dashboard-page">
      <EmployeeSidebar />
      <main className="main-content">
        <h1>Dashboard</h1>

        {loading && <p>Loading...</p>}
        {error && <p className="error-message">{error}</p>}
        
        {!loading && !error && (
          <>
            <div className="kpi-container">
              <div className="kpi-card in-progress">
                <FaHourglassHalf className="kpi-icon" />
                <div className="kpi-info">
                  <p>In Progress</p>
                  <span>{dashboardData.kpis.pending || 0} Modules</span>
                </div>
              </div>
              <div className="kpi-card completed">
                <FaCheckCircle className="kpi-icon" />
                <div className="kpi-info">
                  <p>Completed</p>
                  <span>{dashboardData.kpis.completed || 0} Modules</span>
                </div>
              </div>
            </div>

            <div className="workstream-grid">
              {dashboardData.workstreams.map(ws => (
                <div key={ws.workstream_id} className="workstream-card-static">
                  <div className="workstream-card-image">
                    {ws.image_url ? (
                      <img src={`${API_URL}${ws.image_url}`} alt={ws.title} />
                    ) : (
                      <div className="image-placeholder"></div>
                    )}
                  </div>
                  <div className="workstream-card-content">
                    <h3>{ws.title}</h3>
                    <p>{ws.total_chapters} Modules</p>
                    <div className="progress-bar-container">
                      <div 
                        className="progress-bar"
                        style={{ width: `${ws.progress}%`}}
                      ></div>
                    </div>
                    <p className="progress-text">{Math.round(ws.progress)}% Complete</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default E_Dashboard;
