import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/admin/AdminCommon.css';
import '../../styles/admin/A_Leaderboard.css';

const A_Leaderboard = () => {
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const usersPerPage = 10;

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [workstreams, setWorkstreams] = useState([]);
    const [search, setSearch] = useState("");
    const [selectedWorkstream, setSelectedWorkstream] = useState("");
    const currentUserId = 1; // TODO: Replace with real user ID from context/auth

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const response = await axios.get('http://localhost:8081/leaderboard');
                setLeaderboardData(response.data);
                console.log("Leaderboard data:", response.data);
            } catch (err) {
                setError('Failed to fetch leaderboard data. Please try again later.');
                console.error('Error fetching leaderboard:', err);
            } finally {
                setIsLoading(false);
            }
        };
        const fetchWorkstreams = async () => {
            try {
                const res = await axios.get('http://localhost:8081/workstreams');
                setWorkstreams(res.data);
            } catch {}
        };
        fetchLeaderboard();
        fetchWorkstreams();
    }, []);

    // Filtered leaderboard
    let filtered = leaderboardData;
    if (search.trim()) {
        filtered = filtered.filter(user =>
            (`${user.first_name} ${user.last_name}`.toLowerCase().includes(search.toLowerCase()))
        );
    }
    if (selectedWorkstream) {
        // For demo: filter users who have progress in the selected workstream (assume user has a workstreams field or skip if not available)
        // In real app, backend should support this
        // For now, skip this filter unless you add workstream info to leaderboardData
    }

    // Pagination logic: slice filtered users for current page
    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = filtered.slice(indexOfFirstUser, indexOfLastUser);

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main">
                <div className="admin-header">
                    <div className="header-left">
                        <h1 className="admin-title">Leaderboard</h1>
                    </div>
                    <div className="header-right">
                        <div className="search-container">
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search by name..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="filter-container">
                            <select
                                className="filter-dropdown"
                                value={selectedWorkstream}
                                onChange={e => setSelectedWorkstream(e.target.value)}
                            >
                                <option value="">All Workstreams</option>
                                {workstreams.map(ws => (
                                    <option key={ws.workstream_id} value={ws.workstream_id}>{ws.title}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                {isLoading ? (
                    <div className="loading-message">Loading leaderboard...</div>
                ) : error ? (
                    <div className="error-message">{error}</div>
                ) : (
                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th className="rank-col">Rank</th>
                                    <th className="user-col">Employee</th>
                                    <th className="progress-col">Overall Progress</th>
                                    <th className="status-col">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentUsers.map((user, idx) => (
                                    <tr key={user.user_id} className={user.user_id === currentUserId ? 'highlight-row' : ''}>
                                        <td className="rank-cell">{indexOfFirstUser + idx + 1}</td>
                                        <td className="user-cell">{`${user.first_name} ${user.last_name}`}</td>
                                        <td className="progress-cell">
                                            <div className="progress-bar-container">
                                                <div 
                                                    className="progress-bar"
                                                    style={{ width: `${user.overall_progress}%` }}
                                                ></div>
                                            </div>
                                            <span className="progress-text">{`${user.overall_progress.toFixed(2)}%`}</span>
                                        </td>
                                        <td className="status-cell">
                                            <span className={`status-badge ${user.overall_progress === 100 ? 'status-completed' : 'status-pending'}`}>
                                                {user.overall_progress === 100 ? 'Completed' : 'Pending'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
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
                            {Array.from({ length: Math.ceil(filtered.length / usersPerPage) }, (_, i) => (
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
                              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filtered.length / usersPerPage), prev + 1))}
                              disabled={currentPage === Math.ceil(filtered.length / usersPerPage)}
                            >
                              &raquo;
                            </button>
                          </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default A_Leaderboard; 