import React, { useState, useContext } from 'react';
import loginLogo from '../assets/loginlogoo.png';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { FaGraduationCap, FaBook, FaClipboardCheck, FaMedal, FaSignOutAlt, FaUserCircle, FaArrowLeft, FaComment } from 'react-icons/fa';
import '../styles/EmployeeSidebar.css';
import FeedbackModal from './FeedbackModal';
import NotificationDialog from './NotificationDialog';

const EmployeeSidebar = () => {
  const [isFeedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  let firstName = user && user.first_name ? user.first_name : '';
  let lastName = user && user.last_name ? user.last_name : '';
  const fullName = `${firstName} ${lastName}`.trim();
  const fallbackName = user ? (user.email || 'User') : 'User';
  const displayName = fullName || fallbackName;
  const initials = user ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() : '';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Show 'Back to Admin Pages' if user is admin
  const isAdmin = user && user.isAdmin;
  const handleBackToAdmin = () => {
    navigate('/admin/analytics');
    window.location.reload();
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
  <img src={loginLogo} alt="Logo" className="sidebar-logo-img" />
</div>
      <hr className="sidebar-divider" />
      <div className="sidebar-content">
        <ul className="sidebar-list">
          <li>
            <NavLink to="/employee/dashboard" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
              <FaGraduationCap className="sidebar-icon" /> Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/employee/modules" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
              <FaBook className="sidebar-icon" /> Learning Modules
            </NavLink>
          </li>
          <li>
            <NavLink to="/employee/assessments" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
              <FaClipboardCheck className="sidebar-icon" /> Assessments
            </NavLink>
          </li>
          <li>
            <NavLink to="/employee/leaderboard" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
              <FaMedal className="sidebar-icon" /> Leaderboard
            </NavLink>
          </li>
        </ul>
      </div>
      <div className="sidebar-footer" style={{ marginTop: 'auto', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 0, marginTop: 0, gap: 10, justifyContent: 'center' }}>
          <div className="sidebar-avatar" style={{ marginBottom: 0 }}>{initials || <FaUserCircle />}</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: 6 }}>
            <div style={{ fontWeight: 700, fontSize: '1.08rem', textAlign: 'left', lineHeight: 1, color: '#254EDB', marginBottom: 8 }}>{displayName}</div>
            <div style={{ fontSize: '0.93rem', color: isAdmin ? '#2563eb' : '#b0b8c9', fontWeight: 500, marginTop: 0, marginBottom: 0, textAlign: 'left', lineHeight: 1 }}>{isAdmin ? 'Admin' : 'Employee'}</div>
          </div>
        </div>
        <hr style={{ width: '100%', margin: '12px 0 10px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          {isAdmin && (
            <button
              className="sidebar-logout-btn sidebar-footer-btn"
              style={{ fontSize: '0.98rem', padding: '0.6em 0.7em', marginTop: 0, marginBottom: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={handleBackToAdmin}
            >
              <FaArrowLeft className="sidebar-icon" style={{ fontSize: '1em' }} /> Back to Admin Pages
            </button>
          )}
          <button
            className="sidebar-logout-btn sidebar-footer-btn"
            style={{ fontSize: '0.98rem', padding: '0.6em 0.7em', marginTop: 0, marginBottom: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setFeedbackModalOpen(true)}
          >
            <FaComment className="sidebar-icon" style={{ fontSize: '1.1em' }} /> Feedback
          </button>
          <button
            className="sidebar-logout-btn sidebar-footer-btn"
            style={{ fontSize: '0.98rem', padding: '0.6em 0.7em', marginTop: 0, marginBottom: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={handleLogout}
          >
            <FaSignOutAlt className="sidebar-icon" style={{ fontSize: '1.1em' }} /> Logout
          </button>
        </div>
      </div>
      
      {isFeedbackModalOpen && <FeedbackModal closeModal={() => setFeedbackModalOpen(false)} showNotification={() => setShowNotification(true)} />}
      <NotificationDialog
        message="Thank you for your feedback"
        type="success"
        isVisible={showNotification}
        onClose={() => setShowNotification(false)}
        duration={3000}
      />
    </nav>
  );
};

export default EmployeeSidebar; 