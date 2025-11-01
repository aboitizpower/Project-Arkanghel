import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/admin/AdminCommon.css';
import '../../styles/admin/A_Leaderboard.css';
import LoadingOverlay from '../../components/LoadingOverlay';
import { useAuth } from '../../auth/AuthProvider';

import API_URL from '../../config/api';

const A_Leaderboard = () => {
    const { user } = useAuth(); // Get user from auth context
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
            setIsLoading(true);
            try {
                let response;
                if (selectedWorkstream) {
                    response = await axios.get(`${API_URL}/admin/leaderboard/workstream/${selectedWorkstream}`, { headers: { 'Authorization': `Bearer ${user.token}` } });
                } else {
                    response = await axios.get(`${API_URL}/admin/leaderboard`, { headers: { 'Authorization': `Bearer ${user.token}` } });
                }
                setLeaderboardData(response.data);
                setError(null);
                console.log('Fetched leaderboardData:', response.data); // DEBUG
            } catch (err) {
                console.error('Leaderboard fetch error:', err);
                console.error('Error status:', err.response?.status);
            } finally {
                setIsLoading(false);
            }
        };
        const fetchWorkstreams = async () => {
            try {
                const res = await axios.get(`${API_URL}/workstreams?published_only=true`, { headers: { 'Authorization': `Bearer ${user.token}` } });
                console.log('Workstreams response:', res.data); // DEBUG
                const workstreamsData = res.data?.workstreams || res.data || [];
                setWorkstreams(Array.isArray(workstreamsData) ? workstreamsData : []);
            } catch (err) {
                console.error('Workstreams fetch error:', err);
                setWorkstreams([]);
            }
        };
        fetchLeaderboard();
        fetchWorkstreams();
    }, [selectedWorkstream]);

    // Filtered leaderboard
    let filtered = leaderboardData;
    if (search.trim()) {
        filtered = leaderboardData.filter(user => {
            const name = user.employee_name ?? `${user.first_name ?? ''} ${user.last_name ?? ''}`;
            return name.toLowerCase().includes(search.toLowerCase());
        });
    }
    // Pagination logic: slice filtered users for current page
    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = filtered.slice(indexOfFirstUser, indexOfLastUser);
    console.log('Current users for table:', currentUsers); // DEBUG

    // Get selected workstream name
    const selectedWorkstreamObj = workstreams.find(ws => ws.id == selectedWorkstream);

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main">
                {/* <LoadingOverlay loading={isLoading} /> */}
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
                                onChange={e => { setSelectedWorkstream(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="">All Workstreams</option>
                                {workstreams.map(ws => (
                                    <option key={ws.id} value={ws.id}>{ws.title}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                {/* Always render the table, even if loading or error */}
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th className="rank-col">Rank</th>
                                <th className="user-col">Employee</th>
                                <th className="progress-col" style={{ minWidth: '180px', maxWidth: '260px' }}>Progress</th>
                                <th className="status-col">Workstreams</th>
                                <th className="status-col">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', color: '#888' }}>No data available</td>
                                </tr>
                            ) : (
                                currentUsers.map((user, idx) => (
                                    <tr key={user.user_id} className={user.user_id === currentUserId ? 'highlight-row' : ''}>
                                        <td className="rank-cell">{indexOfFirstUser + idx + 1}</td>
                                        <td className="user-cell">{user.employee_name ?? `${user.first_name ?? ''} ${user.last_name ?? ''}`}</td>
                                        <td className="progress-cell" style={{ minWidth: '220px', maxWidth: '340px' }}>
                                            <div className="progress-bar-container">
                                                <div 
                                                    className="progress-bar"
                                                    style={{ width: `${Number(selectedWorkstream ? user.progress_percent : user.average_progress) ?? 0}%` }}
                                                ></div>
                                            </div>
                                            <span className="progress-text">{`${Number(selectedWorkstream ? user.progress_percent : user.average_progress ?? 0).toFixed(2)}%`}</span>
                                        </td>
                                        <td className="status-cell">
                                            <span className="workstreams-completed">
                                                {user.workstreams_with_progress ?? 0}/{user.total_workstreams ?? 0}
                                            </span>
                                        </td>
                                        <td className="status-cell">
                                            <span className={`status-badge ${user.status?.toLowerCase()}`}>
                                                {user.status ?? 'Pending'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {Math.ceil(leaderboardData.length / usersPerPage) > 1 && (
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
                                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(leaderboardData.length / usersPerPage), prev + 1))}
                                disabled={currentPage === Math.ceil(leaderboardData.length / usersPerPage)}
                                className="pagination-button"
                            >
                                »
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
export default A_Leaderboard; 