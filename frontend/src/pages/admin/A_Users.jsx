import React, { useEffect, useState } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import { FaSort, FaChevronDown, FaSearch, FaCog, FaTrash } from 'react-icons/fa';
import '../../styles/admin/A_Users.css';
import '../../styles/admin/AdminCommon.css';
import { useLocation } from 'react-router-dom';
import LoadingOverlay from '../../components/LoadingOverlay';
import NotificationDialog from '../../components/NotificationDialog';
import { useAuth } from '../../auth/AuthProvider';
import axios from 'axios';

const getInitials = (first, last) => {
  if (!first && !last) return '?';
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
};

const getAvatarColor = (first, last) => {
  const colors = [
    "#2563eb", "#f59e42", "#10b981", "#e11d48", "#6366f1",
    "#fbbf24", "#14b8a6", "#f43f5e", "#a21caf", "#0ea5e9"
  ];
  const str = (first || "") + (last || "");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const A_Users = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 5;

  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [sortOrder, setSortOrder] = useState("none"); // none, admin, employee
  const [sortOpen, setSortOpen] = useState(false);
  const [workstreams, setWorkstreams] = useState([]);
  const [wsModalUser, setWsModalUser] = useState(null); // user object or null
  const [wsModalChecked, setWsModalChecked] = useState([]);
  const [wsModalLoading, setWsModalLoading] = useState(false);
  const [wsModalSaving, setWsModalSaving] = useState(false);
  const [clearProgressUser, setClearProgressUser] = useState(null);
  const [clearingProgress, setClearingProgress] = useState(false);
  const [clearType, setClearType] = useState('all');
  const [selectedWorkstream, setSelectedWorkstream] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [availableWorkstreams, setAvailableWorkstreams] = useState([]);
  const [availableAssessments, setAvailableAssessments] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Notification state
  const [notification, setNotification] = useState({
    isVisible: false,
    message: '',
    type: 'success'
  });

  const closeNotification = () => {
    setNotification({
      isVisible: false,
      message: '',
      type: 'success'
    });
  };

  const location = useLocation();
  useEffect(() => {
    // Close modal and dropdown on route change
    setWsModalUser(null);
    setClearProgressUser(null);
    setSortOpen(false);
  }, [location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortOpen && !event.target.closest('.admin-users-sort-dropdown')) {
        setSortOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sortOpen]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortOrder]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.token) return;
      
      try {
        // Fetch users
        const usersResponse = await axios.get("http://localhost:8081/users", {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });
        setUsers(usersResponse.data.users || []);

        // Fetch workstreams
        const workstreamsResponse = await axios.get("http://localhost:8081/workstreams?published_only=true", {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });
        // Handle both old and new response formats
        const workstreamsData = workstreamsResponse.data?.workstreams || workstreamsResponse.data || [];
        console.log('A_Users workstreams response:', workstreamsResponse.data);
        console.log('A_Users processed workstreams:', workstreamsData);
        setWorkstreams(Array.isArray(workstreamsData) ? workstreamsData : []);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [user?.token]);

  const handleRoleChange = async (userId, currentIsAdmin) => {
    setUpdatingId(userId);
    const newIsAdmin = currentIsAdmin === 1 ? 0 : 1; // Toggle 1 and 0
    try {
      const res = await axios.put(`http://localhost:8081/users/${userId}/role`, 
        { isAdmin: newIsAdmin }, // Send integer
        {
          headers: { 
            "Content-Type": "application/json",
            'Authorization': `Bearer ${user?.token}`
          }
        }
      );
      // Axios automatically throws for error status codes, so if we reach here, it was successful
      // Update the local state with the new integer value
      setUsers(currentUsers =>
        currentUsers.map(u =>
          u.id === userId ? { ...u, isAdmin: newIsAdmin } : u
        )
      );
    } catch (err) {
      setNotification({
        isVisible: true,
        message: "Failed to update role. Please check the server connection.",
        type: 'error'
      });
    }
    setUpdatingId(null);
  };

  // Workstream permission modal logic
  const openWsModal = async (selectedUser) => {
    setWsModalUser(selectedUser);
    setWsModalLoading(true);
    try {
      const res = await axios.get(`http://localhost:8081/users/${selectedUser.id}/workstreams`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });
      // If empty, all are selected
      setWsModalChecked(res.data.workstream_ids.length === 0 ? workstreams.map(w => w.id) : res.data.workstream_ids);
    } catch {
      setWsModalChecked(workstreams.map(w => w.id));
    }
    setWsModalLoading(false);
  };
  const closeWsModal = () => {
    setWsModalUser(null);
    setWsModalChecked([]);
    setWsModalLoading(false);
    setWsModalSaving(false);
  };
  const handleWsCheckbox = (id) => {
    setWsModalChecked(checked =>
      checked.includes(id) ? checked.filter(wid => wid !== id) : [...checked, id]
    );
  };
  const saveWsModal = async () => {
    setWsModalSaving(true);
    try {
      const res = await axios.put(`http://localhost:8081/users/${wsModalUser.id}/workstreams`, 
        { workstream_ids: wsModalChecked },
        {
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user?.token}`
          }
        }
      );

      // Axios automatically throws for error status codes, so if we reach here, it was successful
      setUsers(currentUsers =>
        currentUsers.map(u =>
          u.id === wsModalUser.id ? { ...u, workstream_ids: wsModalChecked } : u
        )
      );
      closeWsModal();
      setNotification({
        isVisible: true,
        message: 'Workstream permissions updated successfully!',
        type: 'success'
      });
    } catch (err) {
      setNotification({
        isVisible: true,
        message: 'Failed to save workstream permissions.',
        type: 'error'
      });
    }
    setWsModalSaving(false);
  };

  // Helper to get summary for a user
  const getUserWsSummary = (user) => {
    // If user has specific workstream permissions set
    if (user.workstream_ids && user.workstream_ids.length > 0) {
      const userWorkstreams = workstreams.filter(w => user.workstream_ids.includes(w.id));
      if (userWorkstreams.length > 2) return `${userWorkstreams.length} Workstreams`;
      return userWorkstreams.map(w => w.title).join(', ');
    }
    // If no specific permissions are set, user has access to all workstreams
    return `${workstreams.length} Workstreams (All)`;
  };

  // Clear progress functionality
  const openClearProgressModal = async (selectedUser) => {
    setClearProgressUser(selectedUser);
    setClearType('all');
    setSelectedWorkstream('');
    setSelectedAssessment('');
    setLoadingOptions(true);
    
    try {
      const res = await axios.get(`http://localhost:8081/users/${selectedUser.id}/progress-options`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });
      
      if (res.data.success) {
        setAvailableWorkstreams(res.data.workstreams || []);
        setAvailableAssessments(res.data.assessments || []);
      } else {
        console.error('Failed to fetch progress options:', res.data.error);
        setAvailableWorkstreams([]);
        setAvailableAssessments([]);
      }
    } catch (err) {
      console.error('Error fetching progress options:', err);
      setAvailableWorkstreams([]);
      setAvailableAssessments([]);
    }
    
    setLoadingOptions(false);
  };

  const closeClearProgressModal = () => {
    setClearProgressUser(null);
    setClearingProgress(false);
    setClearType('all');
    setSelectedWorkstream('');
    setSelectedAssessment('');
    setAvailableWorkstreams([]);
    setAvailableAssessments([]);
    setLoadingOptions(false);
  };

  const handleClearProgress = async () => {
    if (!clearProgressUser) return;
    
    // Validate required selections
    if (clearType === 'workstream' && !selectedWorkstream) {
      setNotification({
        isVisible: true,
        message: 'Please select a workstream to clear.',
        type: 'warning'
      });
      return;
    }
    
    if (clearType === 'assessment' && !selectedAssessment) {
      setNotification({
        isVisible: true,
        message: 'Please select an assessment to clear.',
        type: 'warning'
      });
      return;
    }
    
    setClearingProgress(true);
    try {
      const requestBody = {
        clearType,
        ...(clearType === 'workstream' && { workstreamId: parseInt(selectedWorkstream) }),
        ...(clearType === 'assessment' && { assessmentId: parseInt(selectedAssessment) })
      };
      
      const res = await axios.delete(`http://localhost:8081/users/${clearProgressUser.id}/progress`, {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        data: requestBody
      });
      
      // Axios automatically throws for error status codes, so if we reach here, it was successful
      if (res.data.success) {
        let detailsMessage = `Details:\n- Assessment scores deleted: ${res.data.details.answersDeleted}`;
        if (res.data.details.progressDeleted > 0) {
          detailsMessage += `\n- Chapter progress deleted: ${res.data.details.progressDeleted}`;
        }
        detailsMessage += `\n- Total records deleted: ${res.data.details.totalDeleted}`;
        
        setNotification({
          isVisible: true,
          message: `${res.data.message}\n\n${detailsMessage}`,
          type: 'success'
        });
        closeClearProgressModal();
      } else {
        setNotification({
          isVisible: true,
          message: `Failed to clear progress: ${res.data?.error?.message || 'Unknown error occurred'}`,
          type: 'error'
        });
      }
    } catch (err) {
      console.error('Error clearing progress:', err);
      setNotification({
        isVisible: true,
        message: 'Failed to clear progress. Please check the server connection.',
        type: 'error'
      });
    }
    setClearingProgress(false);
  };

  const filteredUsers = users
    .filter(user => {
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
      const email = (user.email || '').toLowerCase();
      const searchTerm = search.toLowerCase();
      return fullName.includes(searchTerm) || email.includes(searchTerm);
    })
    .filter(user => {
      if (sortOrder === 'admin') return user.isAdmin === 1;
      if (sortOrder === 'employee') return user.isAdmin === 0;
      return true; // 'none'
    });

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <LoadingOverlay loading={users.length === 0} />
        <div className="admin-header">
          <div className="header-left">
            <h1 className="admin-title">User Management</h1>
          </div>
          <div className="header-right">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search by name or email"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <FaSearch className="search-icon" />
              {search && (
                <button
                  className="clear-search-btn"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            <div className="admin-users-sort-dropdown">
              <button
                className="sort-dropdown-btn"
                onClick={() => setSortOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
              >
                <FaSort />
                <span>
                  {sortOrder === 'none' ? 'Sort by Role' : 
                   sortOrder === 'admin' ? 'Admin' : 
                   sortOrder === 'employee' ? 'Employee' : 'Sort by Role'}
                </span>
                <FaChevronDown className={`sort-chevron${sortOpen ? " open" : ""}`} />
              </button>
              {sortOpen && (
                <div className="sort-dropdown-menu">
                  <div
                    className={`sort-dropdown-item${sortOrder === "none" ? " active" : ""}`}
                    onClick={() => { setSortOrder("none"); setSortOpen(false); }}
                  >
                    None
                  </div>
                  <div
                    className={`sort-dropdown-item${sortOrder === "admin" ? " active" : ""}`}
                    onClick={() => { setSortOrder("admin"); setSortOpen(false); }}
                  >
                    Admin
                  </div>
                  <div
                    className={`sort-dropdown-item${sortOrder === "employee" ? " active" : ""}`}
                    onClick={() => { setSortOrder("employee"); setSortOpen(false); }}
                  >
                    Employee
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-users-avatar-col">Avatar</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Workstreams</th>
                <th>Date Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="admin-table-empty">
                    No users found matching your search or filter.
                  </td>
                </tr>
              ) : (
                currentUsers.map(user => (
                  <tr key={user.id}>
                    <td className="admin-users-avatar-col">
                      <div className="admin-users-avatar" style={{ backgroundColor: getAvatarColor(user.first_name, user.last_name) }}>
                        {getInitials(user.first_name, user.last_name)}
                      </div>
                    </td>
                    <td>{user.first_name} {user.last_name}</td>
                    <td>{user.email}</td>
                    <td>
                      <div className="role-select-wrapper">
                        <select
                          className={`role-select ${user.isAdmin ? 'admin' : 'employee'}`}
                          value={user.isAdmin ? '1' : '0'}
                          onChange={() => handleRoleChange(user.id, user.isAdmin)}
                          disabled={updatingId === user.id}
                        >
                          <option value="0">Employee</option>
                          <option value="1">Admin</option>
                        </select>
                        <FaChevronDown className="role-dropdown-arrow" />
                      </div>
                    </td>
                    <td className="admin-users-workstream">
                      <div className="ws-summary">{getUserWsSummary(user)}</div>
                      <button onClick={() => openWsModal(user)} className="ws-configure-btn">
                        <FaCog />
                        <span>Configure</span>
                      </button>
                    </td>
                    <td>
                      {new Date(user.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="admin-users-actions">
                      <button 
                        onClick={() => openClearProgressModal(user)} 
                        className="clear-progress-btn"
                        title="Clear all progress for this user"
                      >
                        <FaTrash />
                        <span>Clear Progress</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {Math.ceil(filteredUsers.length / usersPerPage) > 1 && (
            <div className="pagination-container">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="pagination-button"
              >
                «
              </button>
              <span className="pagination-info">{currentPage}</span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredUsers.length / usersPerPage), prev + 1))}
                disabled={currentPage === Math.ceil(filteredUsers.length / usersPerPage)}
                className="pagination-button"
              >
                »
              </button>
            </div>
          )}
        </div>
        {/* Workstream Permission Modal */}
        {wsModalUser && (
          <div className="ws-modal-overlay" onClick={closeWsModal}>
            <div className="ws-modal" onClick={e => e.stopPropagation()}>
              <div className="ws-modal-header">
                <h2>Configure Workstream Access for {wsModalUser.first_name} {wsModalUser.last_name}</h2>
                <button className="ws-modal-close" onClick={closeWsModal} aria-label="Close">×</button>
              </div>
              {wsModalLoading ? (
                <div className="ws-modal-loading">Loading...</div>
              ) : (
                <>
                  <div className="ws-modal-checklist-header">
                    <label className="ws-checkbox-item ws-select-all">
                      <input
                        type="checkbox"
                        checked={wsModalChecked.length === workstreams.length}
                        indeterminate={wsModalChecked.length > 0 && wsModalChecked.length < workstreams.length ? 'true' : undefined}
                        onChange={e => setWsModalChecked(e.target.checked ? workstreams.map(w => w.id) : [])}
                      />
                      Select All
                    </label>
                    <span className="ws-selected-count">{wsModalChecked.length} selected</span>
                  </div>
                  <div className="ws-modal-checklist-area">
                    <form className="ws-checkbox-list">
                      {workstreams.map(ws => (
                        <label key={ws.id} className="ws-checkbox-item">
                          <input
                            type="checkbox"
                            checked={wsModalChecked.includes(ws.id)}
                            onChange={() => handleWsCheckbox(ws.id)}
                          />
                          {ws.title}
                        </label>
                      ))}
                    </form>
                  </div>
                </>
              )}
              <hr className="ws-modal-divider" />
              <div className="ws-modal-actions">
                <button onClick={closeWsModal} disabled={wsModalSaving}>Cancel</button>
                <button onClick={saveWsModal} disabled={wsModalSaving}>{wsModalSaving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Clear Progress Confirmation Modal */}
        {clearProgressUser && (
          <div className="ws-modal-overlay" onClick={closeClearProgressModal}>
            <div className="ws-modal clear-progress-modal" onClick={e => e.stopPropagation()}>
              <div className="ws-modal-header">
                <h2>Clear Progress for {clearProgressUser.first_name} {clearProgressUser.last_name}</h2>
                <button className="ws-modal-close" onClick={closeClearProgressModal} aria-label="Close">×</button>
              </div>
              <div className="clear-progress-content">
                <p className="warning-message">
                  Select the type of progress data to clear for this user:
                </p>
                
                {loadingOptions ? (
                  <div className="loading-options">Loading available options...</div>
                ) : (
                  <div className="clear-options">
                    <div className="clear-option">
                      <label className="clear-option-label">
                        <input
                          type="radio"
                          name="clearType"
                          value="all"
                          checked={clearType === 'all'}
                          onChange={(e) => setClearType(e.target.value)}
                        />
                        <div className="clear-option-content">
                          <span className="clear-option-title">Clear All Progress</span>
                          <span className="clear-option-desc">Removes all chapter progress and assessment attempts</span>
                        </div>
                      </label>
                    </div>
                    
                    <div className="clear-option">
                      <label className="clear-option-label">
                        <input
                          type="radio"
                          name="clearType"
                          value="assessments"
                          checked={clearType === 'assessments'}
                          onChange={(e) => setClearType(e.target.value)}
                        />
                        <div className="clear-option-content">
                          <span className="clear-option-title">Clear All Assessment Attempts</span>
                          <span className="clear-option-desc">Removes all assessment scores and attempts (keeps chapter progress)</span>
                        </div>
                      </label>
                    </div>
                    
                    <div className="clear-option">
                      <label className="clear-option-label">
                        <input
                          type="radio"
                          name="clearType"
                          value="workstream"
                          checked={clearType === 'workstream'}
                          onChange={(e) => setClearType(e.target.value)}
                          disabled={availableWorkstreams.length === 0}
                        />
                        <div className="clear-option-content">
                          <span className="clear-option-title">Clear Selected Workstream Progress</span>
                          <span className="clear-option-desc">Removes progress for a specific workstream only</span>
                          {clearType === 'workstream' && (
                            <div className="clear-option-select">
                              <select
                                value={selectedWorkstream}
                                onChange={(e) => setSelectedWorkstream(e.target.value)}
                                disabled={availableWorkstreams.length === 0}
                              >
                                <option value="">Select a workstream...</option>
                                {availableWorkstreams.map(ws => (
                                  <option key={ws.workstream_id} value={ws.workstream_id}>
                                    {ws.title} ({ws.chapter_progress_count} chapters, {ws.answer_count} answers)
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                    
                    <div className="clear-option">
                      <label className="clear-option-label">
                        <input
                          type="radio"
                          name="clearType"
                          value="assessment"
                          checked={clearType === 'assessment'}
                          onChange={(e) => setClearType(e.target.value)}
                          disabled={availableAssessments.length === 0}
                        />
                        <div className="clear-option-content">
                          <span className="clear-option-title">Clear Selected Assessment Progress</span>
                          <span className="clear-option-desc">Removes attempts for a specific assessment only</span>
                          {clearType === 'assessment' && (
                            <div className="clear-option-select">
                              <select
                                value={selectedAssessment}
                                onChange={(e) => setSelectedAssessment(e.target.value)}
                                disabled={availableAssessments.length === 0}
                              >
                                <option value="">Select an assessment...</option>
                                {availableAssessments.map(assessment => (
                                  <option key={assessment.assessment_id} value={assessment.assessment_id}>
                                    {assessment.title} - {assessment.workstream_title || assessment.chapter_title} ({assessment.answer_count} answers)
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>
                )}
                
                <p className="confirmation-text">
                  This action <strong>cannot be undone</strong>. Are you sure you want to continue?
                </p>
              </div>
              <hr className="ws-modal-divider" />
              <div className="ws-modal-actions">
                <button onClick={closeClearProgressModal} disabled={clearingProgress}>Cancel</button>
                <button 
                  onClick={handleClearProgress} 
                  disabled={clearingProgress || loadingOptions}
                  className="danger-btn"
                >
                  {clearingProgress ? 'Clearing...' : `Clear ${clearType === 'all' ? 'All' : clearType === 'assessments' ? 'Assessment' : clearType === 'workstream' ? 'Workstream' : 'Assessment'} Progress`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notification Dialog */}
        <NotificationDialog
          message={notification.message}
          type={notification.type}
          isVisible={notification.isVisible}
          onClose={closeNotification}
        />
      </main>
    </div>
  );
};

export default A_Users;