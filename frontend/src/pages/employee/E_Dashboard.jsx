import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_Dashboard.css'; // Dashboard-specific styles
import '../../styles/employee/E_Modules.css';    // For workstream card styles
import { FaCheckCircle, FaHourglassHalf } from 'react-icons/fa';
import LoadingOverlay from '../../components/LoadingOverlay';

const API_URL = 'http://localhost:8081';

const E_Dashboard = () => {
  const [workstreams, setWorkstreams] = useState([]);
  const [kpiMetrics, setKpiMetrics] = useState({ inProgress: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');
  const userId = localStorage.getItem('userId');
  const navigate = useNavigate();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const workstreamsPerPage = 8;

  useEffect(() => {
    if (userId) {
      const fetchDashboardData = async () => {
        try {
          const response = await axios.get(`${API_URL}/employee/dashboard/${userId}`);
          const workstreamsData = response.data.workstreams;
          setWorkstreams(workstreamsData);
          
          // Calculate KPIs based on workstream progress
          const inProgressCount = workstreamsData.filter(ws => {
            const progress = Math.round(ws.progress || 0);
            return progress === 0 && (ws.chapters_count > 0 || ws.assessments_count > 0);
          }).length;
          
          const completedCount = workstreamsData.filter(ws => {
            const progress = Math.round(ws.progress || 0);
            return progress === 100;
          }).length;
          
          setKpiMetrics({
            inProgress: inProgressCount,
            completed: completedCount
          });
          setUserName(response.data.user.name);
        } catch (err) {
          console.error('Full API Error:', err);
          const errorMessage = err.response?.data?.details || err.response?.data?.error || err.message || 'Failed to fetch dashboard data.';
          setError(errorMessage);
          console.error('Error fetching dashboard data:', err);
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

  const startIndex = (currentPage - 1) * workstreamsPerPage;
  const endIndex = startIndex + workstreamsPerPage;
  const currentWorkstreams = workstreams.slice(startIndex, endIndex);

  return (
    <div className="employee-dashboard-page">
      <EmployeeSidebar />
      <main className="main-content">
        <LoadingOverlay loading={loading} />
        <h1 className="welcome-header">Welcome, {userName}!</h1>
        
        {error && <p className="error-message">{error}</p>}
        
        {!loading && !error && workstreams.length === 0 && (
          <p className="no-workstreams-message">No workstreams assigned to you. Please contact your administrator.</p>
        )}
        
        {!loading && !error && (
          <>
            <div className="kpi-container">
              <div className="kpi-card in-progress">
                <FaHourglassHalf className="kpi-icon" />
                <div className="kpi-info">
                  <p>In Progress</p>
                  <span>{kpiMetrics.inProgress} Workstreams</span>
                </div>
              </div>
              <div className="kpi-card completed">
                <FaCheckCircle className="kpi-icon" />
                <div className="kpi-info">
                  <p>Completed</p>
                  <span>{kpiMetrics.completed} Workstreams</span>
                </div>
              </div>
            </div>

            <div className="grid-container-ws">
              {currentWorkstreams.map(ws => {
                  const progress = Math.round(ws.progress || 0);
                  const hasContent = ws.chapters_count > 0 || ws.assessments_count > 0;

                  return (
                      <div 
                          key={ws.workstream_id} 
                          className={`card-ws ${!hasContent ? 'inactive' : ''}`}
                      >
                          <div className="card-ws-image-container">
                              {ws.image_type ? 
                                  <img src={`${API_URL}/workstreams/${ws.workstream_id}/image`} alt={ws.title} className="card-ws-image"/> :
                                  <div className="card-ws-image-placeholder"></div>
                              }
                          </div>
                          <div className="card-ws-content">
                              <h3 className="card-ws-title">{ws.title}</h3>
                              <div className="card-ws-stats">
                                  <span>{ws.chapters_count || 0} Chapters</span>
                                  <span>•</span>
                                  <span>{ws.assessments_count || 0} Assessments</span>
                              </div>
                              {hasContent ? (
                                  <>
                                      <div className="card-ws-progress">
                                          <span className="progress-label">Progress</span>
                                          <span className="progress-percentage">{progress}%</span>
                                      </div>
                                      <div className="progress-bar-container">
                                          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                                      </div>
                                  </>
                              ) : (
                                  <div className="no-content-container">
                                      <p>No content available</p>
                                  </div>
                              )}
                          </div>
                      </div>
                  );
              })}
            </div>

            {/* Pagination Controls */}
            {Math.ceil(workstreams.length / workstreamsPerPage) > 1 && (
                <div className="pagination-wrapper">
                    <div className="pagination-container">
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="pagination-btn"
                        >
                            &laquo;
                        </button>
                        {[...Array(Math.ceil(workstreams.length / workstreamsPerPage)).keys()].map(number => (
                            <button 
                                key={number + 1}
                                onClick={() => setCurrentPage(number + 1)}
                                className={`pagination-btn ${currentPage === number + 1 ? 'active' : ''}`}
                            >
                                {number + 1}
                            </button>
                        ))}
                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(workstreams.length / workstreamsPerPage), prev + 1))}
                            disabled={currentPage === Math.ceil(workstreams.length / workstreamsPerPage)}
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
