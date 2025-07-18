import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_Dashboard.css'; // New CSS file
import { FaCheckCircle, FaHourglassHalf, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import LoadingOverlay from '../../components/LoadingOverlay';

const API_URL = 'http://localhost:8081';

const E_Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({ kpis: {}, workstreams: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');
  const userId = localStorage.getItem('userId');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const workstreamsPerPage = 8;

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.first_name) {
        setUserName(user.first_name);
    }
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
        <LoadingOverlay loading={loading} />
        <h1 className="welcome-header">Welcome, {userName}!</h1>
        
        {error && <p className="error-message">{error}</p>}
        
        {!loading && !error && dashboardData.workstreams.length === 0 && (
          <p className="no-workstreams-message">No workstreams assigned to you. Please contact your administrator.</p>
        )}
        
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

            {(() => {
                const startIndex = (currentPage - 1) * workstreamsPerPage;
                const endIndex = startIndex + workstreamsPerPage;
                const currentWorkstreams = dashboardData.workstreams.slice(startIndex, endIndex);

                return (
                    <div className="workstream-grid">
                        {currentWorkstreams.map(ws => (
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
                                    {ws.total_chapters > 0 ? (
                                        <>
                                            <div className="progress-bar-container">
                                                <div 
                                                    className="progress-bar"
                                                    style={{ width: `${ws.progress}%`}}
                                                ></div>
                                            </div>
                                            <p className="progress-text">{Math.round(ws.progress)}% Complete</p>
                                        </>
                                    ) : (
                                        <p className="no-content-text">No content available</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })()}

            {/* Pagination Controls */}
            {Math.ceil(dashboardData.workstreams.length / workstreamsPerPage) > 1 && (
                <div className="pagination-wrapper">
                    <div className="pagination-container">
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="pagination-btn"
                        >
                            &laquo;
                        </button>
                        {[...Array(Math.ceil(dashboardData.workstreams.length / workstreamsPerPage)).keys()].map(number => (
                            <button 
                                key={number + 1}
                                onClick={() => setCurrentPage(number + 1)}
                                className={`pagination-btn ${currentPage === number + 1 ? 'active' : ''}`}
                            >
                                {number + 1}
                            </button>
                        ))}
                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(dashboardData.workstreams.length / workstreamsPerPage), prev + 1))}
                            disabled={currentPage === Math.ceil(dashboardData.workstreams.length / workstreamsPerPage)}
                            className="pagination-btn"
                        >
                            &raquo;
                        </button>
                    </div>
                </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default E_Dashboard;
