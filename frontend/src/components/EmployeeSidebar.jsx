import React from 'react';
import loginLogo from '../assets/loginlogoo.png';
import { NavLink, useNavigate } from 'react-router-dom';
import { FaGraduationCap, FaBook, FaClipboardCheck, FaMedal, FaSignOutAlt, FaUserCircle } from 'react-icons/fa';
import '../styles/EmployeeSidebar.css';

const EmployeeSidebar = () => {
  const navigate = useNavigate();
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('user'));
  } catch (e) {}
  const fullName = user ? `${user.first_name} ${user.last_name}` : '';
  const initials = user ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() : '';

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
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
      <div className="sidebar-footer">
        <div className="sidebar-avatar-name">
  <div className="sidebar-avatar">{initials || <FaUserCircle />}</div>
  <div className="sidebar-user-info">
    <div className="sidebar-user-name">{fullName}</div>
    <div className="sidebar-role">Employee</div>
  </div>
</div>
        <button className="sidebar-logout-btn" onClick={handleLogout}>
          <FaSignOutAlt className="sidebar-icon" /> Logout
        </button>
      </div>
      
    </nav>
  );
};

export default EmployeeSidebar; 