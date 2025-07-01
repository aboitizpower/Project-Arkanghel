import React, { useEffect, useState } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import { FaSort, FaChevronDown } from 'react-icons/fa';
import '../../styles/admin/A_Users.css';

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

  useEffect(() => {
    fetch("http://localhost:8081/users")
      .then(res => res.json())
      .then(data => setUsers(data.users || []));
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
    <div className="admin-users-layout">
      <AdminSidebar />
      <main className="admin-users-main">
        <div className="admin-users-header improved-header">
          <div>
            <h1 className="admin-users-title">User Management</h1>
          </div>
          <div className="admin-users-header-actions">
            <div className="admin-users-search-sort-row">
              <input
                type="text"
                placeholder="Search by name or email"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="admin-users-search"
              />
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
        </div>
        <div className="admin-users-table-container">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th className="avatar-col">Avatar</th>
                <th className="fullname-col">Full Name</th>
                <th className="email-col">Email</th>
                <th className="role-col">Role</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-users-no-users">No users found.</td>
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default A_Users;