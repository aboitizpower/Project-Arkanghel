import React, { useState, useEffect } from 'react';
import { FaCalendarAlt, FaClock, FaBug, FaLightbulb } from 'react-icons/fa';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/admin/A_Feedback.css';
import { useAuth } from '../../auth/AuthProvider';

const A_Feedback = () => {
  const { user } = useAuth(); // Get user from auth context
  const [feedback, setFeedback] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Pagination logic
  const itemsPerPage = 6;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentFeedback = feedback.slice(startIndex, endIndex);

  const totalPages = Math.ceil(feedback.length / itemsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const response = await fetch('http://localhost:8081/admin/feedback', {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch feedback');
        }
        const data = await response.json();
        setFeedback(data);
      } catch (error) {
        console.error('Error fetching feedback:', error);
      }
    };

    fetchFeedback();
  }, []);

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-main-content">
          <div className="admin-header">
            <h1 className="admin-title">Employee's Feedback</h1>
          </div>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Message</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {currentFeedback.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="feedback-author-info">
                        <div className="feedback-avatar">{`${item.first_name?.[0] || ''}${item.last_name?.[0] || ''}`.toUpperCase()}</div>
                        <span className="feedback-author">{`${item.first_name} ${item.last_name}`}</span>
                      </div>
                    </td>
                    <td>
                      <div className={`feedback-type ${item.subject?.toLowerCase().replace(' ', '-')}`}>
                        {item.subject === 'Bug Report' 
                          ? <FaBug className="type-icon" /> 
                          : <FaLightbulb className="type-icon" />}
                        <span>{item.subject}</span>
                      </div>
                    </td>
                    <td>
                      <p className="feedback-message">{item.message}</p>
                    </td>
                    <td>
                      <div className="feedback-timestamp">
                        <div className="feedback-date">
                          <FaCalendarAlt className="timestamp-icon" />
                          <span>{new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <div className="feedback-time">
                          <FaClock className="timestamp-icon" />
                          <span>{new Date(item.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="pagination-container">
              <button onClick={handlePrevPage} disabled={currentPage === 1} className="pagination-button">
                «
              </button>
              <span className="pagination-info">{currentPage}</span>
              <button onClick={handleNextPage} disabled={currentPage === totalPages} className="pagination-button">
                »
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default A_Feedback;
