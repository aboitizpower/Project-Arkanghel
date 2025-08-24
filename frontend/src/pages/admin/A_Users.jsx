import React, { useEffect, useState } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import { FaSort, FaChevronDown, FaSearch, FaCog } from 'react-icons/fa';
import '../../styles/admin/A_Users.css';
import '../../styles/admin/AdminCommon.css';
import { useLocation } from 'react-router-dom';
import LoadingOverlay from '../../components/LoadingOverlay';

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

  const location = useLocation();
  useEffect(() => {
    // Close modal and dropdown on route change
    setWsModalUser(null);
    setSortOpen(false);
  }, [location.pathname]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortOrder]);

  useEffect(() => {
    fetch("http://localhost:8081/users")
      .then(res => res.json())
      .then(data => {
        // Keep isAdmin as an integer (1/0) for consistency
        setUsers(data.users || []);
      });
    fetch("http://localhost:8081/workstreams")
      .then(res => res.json())
      .then(data => setWorkstreams(data || []));
  }, []);

  const handleRoleChange = async (userId, currentIsAdmin) => {
    setUpdatingId(userId);
    const newIsAdmin = currentIsAdmin === 1 ? 0 : 1; // Toggle 1 and 0
    try {
      const res = await fetch(`http://localhost:8081/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: newIsAdmin }), // Send integer
      });
      if (res.ok) {
        // Update the local state with the new integer value
        setUsers(currentUsers =>
          currentUsers.map(u =>
            u.id === userId ? { ...u, isAdmin: newIsAdmin } : u
          )
        );
      } else {
        // If the API call fails, show an error and don't change the UI
        const errorData = await res.json().catch(() => ({ error: 'An unknown error occurred.' }));
        alert(`Failed to update role: ${errorData.error}`);
      }
    } catch (err) {
      alert("Failed to update role. Please check the server connection.");
    }
    setUpdatingId(null);
  };

  // Workstream permission modal logic
  const openWsModal = async (user) => {
    setWsModalUser(user);
    setWsModalLoading(true);
    try {
      const res = await fetch(`http://localhost:8081/users/${user.id}/workstreams`);
      const data = await res.json();
      // If empty, all are selected
      setWsModalChecked(data.workstream_ids.length === 0 ? workstreams.map(w => w.workstream_id) : data.workstream_ids);
    } catch {
      setWsModalChecked(workstreams.map(w => w.workstream_id));
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
      const res = await fetch(`http://localhost:8081/users/${wsModalUser.id}/workstreams`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workstream_ids: wsModalChecked })
      });

      if (res.ok) {
        setUsers(currentUsers =>
          currentUsers.map(u =>
            u.id === wsModalUser.id ? { ...u, workstream_ids: wsModalChecked } : u
          )
        );
        closeWsModal();
      } else {
        alert('Failed to save workstream permissions.');
      }
    } catch (err) {
      alert('Failed to save workstream permissions.');
    }
    setWsModalSaving(false);
  };

  // Helper to get summary for a user
  const getUserWsSummary = (user) => {
    // If user has specific workstream permissions set
    if (user.workstream_ids && user.workstream_ids.length > 0) {
      const userWorkstreams = workstreams.filter(w => user.workstream_ids.includes(w.workstream_id));
      if (userWorkstreams.length > 2) return `${userWorkstreams.length} Workstreams`;
      return userWorkstreams.map(w => w.title).join(', ');
    }
    // If no specific permissions are set, user has access to all workstreams
    return `${workstreams.length} Workstreams (All)`;
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
            <div
              className="admin-users-sort-dropdown"
              tabIndex={0}
              onBlur={() => setTimeout(() => setSortOpen(false), 120)}
            >
              <button
                className="sort-dropdown-btn"
                onClick={() => setSortOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
              >
                <FaSort />
                <span>Sort by Role</span>
                <FaChevronDown className={`sort-chevron${sortOpen ? " open" : ""}`} />
              </button>
              {sortOpen && (
                <div className="sort-dropdown-menu">
                  <div
                    className="sort-dropdown-item"
                    onClick={() => { setSortOrder("none"); setSortOpen(false); }}
                  >
                    None
                  </div>
                  <div
                    className="sort-dropdown-item"
                    onClick={() => { setSortOrder("admin"); setSortOpen(false); }}
                  >
                    Admin
                  </div>
                  <div
                    className="sort-dropdown-item"
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
              </tr>
            </thead>
            <tbody>
              {currentUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="admin-table-empty">
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="pagination-wrapper">
            <div className="pagination-container">
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                &laquo;
              </button>
              {Array.from({ length: Math.ceil(filteredUsers.length / usersPerPage) }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`pagination-btn${currentPage === i + 1 ? ' active' : ''}`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredUsers.length / usersPerPage), prev + 1))}
                disabled={currentPage === Math.ceil(filteredUsers.length / usersPerPage)}
              >
                &raquo;
              </button>
            </div>
          </div>
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
                        onChange={e => setWsModalChecked(e.target.checked ? workstreams.map(w => w.workstream_id) : [])}
                      />
                      Select All
                    </label>
                    <span className="ws-selected-count">{wsModalChecked.length} selected</span>
                  </div>
                  <div className="ws-modal-checklist-area">
                    <form className="ws-checkbox-list">
                      {workstreams.map(ws => (
                        <label key={ws.workstream_id} className="ws-checkbox-item">
                          <input
                            type="checkbox"
                            checked={wsModalChecked.includes(ws.workstream_id)}
                            onChange={() => handleWsCheckbox(ws.workstream_id)}
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
      </main>
    </div>
  );
};

export default A_Users;