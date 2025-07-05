import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FaChartBar, FaLayerGroup, FaTasks, FaUserFriends, FaTrophy, FaSignOutAlt, FaUserCircle } from 'react-icons/fa';
import '../styles/Sidebar.css';

const AdminSidebar = () => {
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
        <div className="sidebar-app-title">Project Arkanghel</div>
        <div className="sidebar-portal-title">Admin Portal</div>
      </div>
      <hr className="sidebar-divider" />
      <div className="sidebar-content">
        <ul className="sidebar-list">
          <li>
            <NavLink to="/admin/analytics" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
              <FaChartBar className="sidebar-icon" /> Analytics
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/modules" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
              <FaLayerGroup className="sidebar-icon" /> Workstream Management
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
              <FaUserFriends className="sidebar-icon" /> User Management
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/leaderboard" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
              <FaTrophy className="sidebar-icon" /> Leaderboard
            </NavLink>
          </li>
        </ul>
      </div>
      <div className="sidebar-footer">
        <div className="sidebar-avatar-name">
          <div className="sidebar-avatar">{initials || <FaUserCircle />}</div>
          <div className="sidebar-user-name">{fullName}</div>
        </div>
        <button className="sidebar-logout-btn" onClick={handleLogout}>
          <FaSignOutAlt className="sidebar-icon" /> Logout
        </button>
      </div>
    </nav>
  );
};

export default AdminSidebar; 