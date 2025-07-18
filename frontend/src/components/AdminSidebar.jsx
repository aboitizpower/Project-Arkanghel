import React, { useContext } from 'react';
import loginLogo from '../assets/loginlogoo.png';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../App';
import { FaChartBar, FaLayerGroup, FaTasks, FaUserFriends, FaTrophy, FaSignOutAlt, FaUserCircle, FaUserTie, FaArrowLeft } from 'react-icons/fa';
import '../styles/AdminSidebar.css';

const AdminSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useContext(AuthContext);
  let firstName = user && user.first_name ? user.first_name : '';
  let lastName = user && user.last_name ? user.last_name : '';
  const fullName = `${firstName} ${lastName}`.trim();
  const fallbackName = user ? (user.email || 'Admin User') : 'Admin User';
  const displayName = fullName || fallbackName;
  const initials = user ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() : '';

  const handleLogout = () => {
    if (setUser) setUser(null);
    localStorage.removeItem('user');
    navigate('/');
    window.location.reload();
  };

  // Show 'Back to Admin Pages' if on employee page, otherwise show 'View Employee Pages'
  const isOnEmployeePage = location.pathname.startsWith('/employee/');
  const handleSwitch = () => {
    if (isOnEmployeePage) {
      navigate('/admin/analytics');
    } else {
      navigate('/employee/dashboard');
    }
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
            <NavLink to="/admin/assessment" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
              <FaTasks className="sidebar-icon" /> Assessment Management
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
      <div className="sidebar-footer" style={{ marginTop: 'auto', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 0, marginTop: 0, gap: 10, justifyContent: 'center' }}>
          <div className="sidebar-avatar" style={{ marginBottom: 0 }}>{initials || <FaUserCircle />}</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: 6 }}>
            <div style={{ fontWeight: 700, fontSize: '1.08rem', textAlign: 'left', lineHeight: 1, color: '#254EDB', marginBottom: 8 }}>{displayName}</div>
            <div style={{ fontSize: '0.93rem', color: '#b0b8c9', fontWeight: 500, marginTop: 0, marginBottom: 0, textAlign: 'left', lineHeight: 1 }}>Admin</div>
          </div>
        </div>
        <hr style={{ width: '100%', margin: '12px 0 10px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <button
            className="sidebar-logout-btn sidebar-footer-btn"
            style={{ fontSize: '0.93rem', padding: '0.5em 0.7em', marginTop: 0, marginBottom: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={handleSwitch}
          >
            {isOnEmployeePage ? <><FaArrowLeft className="sidebar-icon" style={{ fontSize: '1em' }} /> Back to Admin Pages</> : <><FaUserTie className="sidebar-icon" style={{ fontSize: '1em' }} /> View Employee Pages</>}
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
    </nav>
  );
};

export default AdminSidebar; 