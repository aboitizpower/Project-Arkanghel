import React, { useEffect, useState } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import { FaSort, FaChevronDown, FaSearch, FaCog } from 'react-icons/fa';
import '../../styles/admin/A_Users.css';
import '../../styles/admin/AdminCommon.css';

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
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [sortOrder, setSortOrder] = useState("none"); // none, admin, employee
  const [sortOpen, setSortOpen] = useState(false);
  const [workstreams, setWorkstreams] = useState([]);
  const [wsModalUser, setWsModalUser] = useState(null); // user object or null
  const [wsModalChecked, setWsModalChecked] = useState([]);
  const [wsModalLoading, setWsModalLoading] = useState(false);
  const [wsModalSaving, setWsModalSaving] = useState(false);

  useEffect(() => {
    fetch("http://localhost:8081/users")
      .then(res => res.json())
      .then(data => setUsers(data.users || []));
    fetch("http://localhost:8081/workstreams")
      .then(res => res.json())
      .then(data => setWorkstreams(data || []));
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingId(userId);
    try {
      const res = await fetch(`http://localhost:8081/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: newRole === "Admin" }),
      });
      if (res.ok) {
        setUsers(users =>
          users.map(u =>
            u.id === userId ? { ...u, isAdmin: newRole === "Admin" } : u
          )
        );
      }
    } catch (err) {
      alert("Failed to update role.");
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
      await fetch(`http://localhost:8081/users/${wsModalUser.id}/workstreams`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workstream_ids: wsModalChecked.length === workstreams.length ? [] : wsModalChecked })
      });
      closeWsModal();
    } catch {
      alert('Failed to save workstream permissions.');
      setWsModalSaving(false);
    }
  };

  // Helper to get summary for a user
  const getUserWsSummary = (user) => {
    // This is a simple approach: if user has custom permissions, show count, else 'All'
    // For performance, you may want to cache this in state if many users
    // But for now, fetch synchronously (not ideal for large tables)
    // We'll just show 'All' for now, or 'Custom' if not all (for demo)
    // Optionally, you can fetch and cache per user on mount
    return <button className="ws-configure-btn" onClick={() => openWsModal(user)}><FaCog style={{marginRight:4}}/>Configure</button>;
  };

  let filteredUsers = users.filter(
    user =>
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  );

  if (sortOrder === "admin") {
    filteredUsers = [...filteredUsers].sort((a, b) => b.isAdmin - a.isAdmin);
  } else if (sortOrder === "employee") {
    filteredUsers = [...filteredUsers].sort((a, b) => a.isAdmin - b.isAdmin);
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
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
                className="search-input"
                style={{ paddingRight: search ? '2.5rem' : '2rem' }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="clear-search"
                  title="Clear search"
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
                <FaSort style={{ marginRight: 8 }} />
                {sortOrder === "admin"
                  ? "Sort: Admin"
                  : sortOrder === "employee"
                  ? "Sort: Employee"
                  : "Sort by Role"}
                <FaChevronDown style={{ marginLeft: 8, fontSize: 13 }} />
              </button>
              <div
                className="sort-dropdown-content"
                style={{ display: sortOpen ? "block" : "none" }}
              >
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
            </div>
          </div>
        </div>
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="avatar-col">Avatar</th>
                <th className="fullname-col">Full Name</th>
                <th className="email-col">Email</th>
                <th className="role-col">Role</th>
                <th className="workstream-col">Workstream</th>
                <th className="date-col">Date Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-users-no-users">No users found.</td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td className="admin-users-avatar-cell">
                      <div
                        className="admin-users-avatar"
                        style={{ background: getAvatarColor(user.first_name, user.last_name) }}
                        title={`${user.first_name} ${user.last_name}`}
                      >
                        {getInitials(user.first_name, user.last_name)}
                      </div>
                    </td>
                    <td className="admin-users-fullname">{user.first_name} {user.last_name}</td>
                    <td className="admin-users-email">{user.email}</td>
                    <td className="admin-users-role">
                      <div className="role-select-wrapper">
                        <select
                          value={user.isAdmin ? "Admin" : "Employee"}
                          onChange={e => handleRoleChange(user.id, e.target.value)}
                          disabled={updatingId === user.id}
                          className={`role-select ${user.isAdmin ? "admin" : "employee"}`}
                        >
                          <option value="Employee">Employee</option>
                          <option value="Admin">Admin</option>
                        </select>
                        <span className="role-dropdown-arrow">&#9662;</span>
                      </div>
                    </td>
                    <td className="admin-users-workstream">
                      {getUserWsSummary(user)}
                    </td>
                    <td className="admin-users-date">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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