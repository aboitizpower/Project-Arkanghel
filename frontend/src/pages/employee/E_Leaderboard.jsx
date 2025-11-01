import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_Leaderboard.css';
import LoadingOverlay from '../../components/LoadingOverlay';
import { useAuth } from '../../auth/AuthProvider';
import API_URL from '../../config/api';

const E_Leaderboard = () => {
    const { user } = useAuth(); // Get user from auth context
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const usersPerPage = 10; // You can adjust this number

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const response = await axios.get(`${API_URL}/employee/leaderboard`, { headers: { 'Authorization': `Bearer ${user.token}` } });
                setLeaderboardData(response.data);
            } catch (err) {
                setError('Failed to fetch leaderboard data. Please try again later.');
                console.error('Error fetching leaderboard:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    // Get current users for pagination
    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = leaderboardData.slice(indexOfFirstUser, indexOfLastUser);

    // Change page
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    return (
        <div className="page-layout">
            <EmployeeSidebar />
            <main className="leaderboard-main-content">
                <LoadingOverlay loading={isLoading} />
                <div className="page-header">
                    <h1 className="page-title">Leaderboard</h1>
                </div>

                {isLoading ? (
                    <div className="loading-message">Loading leaderboard...</div>
                ) : error ? (
                    <div className="error-message">{error}</div>
                ) : (
                    <div className="table-container">
                        <table className="leaderboard-table">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Employee</th>
                                    <th>Overall Progress</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentUsers.map((user, index) => (
                                    <tr key={user.user_id}>
                                        <td className="rank-cell">{indexOfFirstUser + index + 1}</td>
                                        <td className="user-cell">{`${user.first_name} ${user.last_name}`}</td>
                                        <td className="progress-cell">
                                            <div className="progress-bar-container">
                                                <div 
                                                    className="progress-bar"
                                                    style={{ width: `${user.average_progress || 0}%` }}
                                                ></div>
                                            </div>
                                            <span className="progress-text">{`${(user.average_progress || 0).toFixed(2)}%`}</span>
                                        </td>
                                        <td className="status-cell">
                                            <span className={`status-badge ${user.status === 'Completed' ? 'status-completed' : 'status-pending'}`}>
                                                {user.status || 'Pending'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {Math.ceil(leaderboardData.length / usersPerPage) > 1 && (
                    <div className="pagination-container">
                        <button 
                            onClick={() => paginate(currentPage - 1)} 
                            disabled={currentPage === 1}
                            className="pagination-button"
                        >
                            «
                        </button>
                        <span className="pagination-info">{currentPage}</span>
                        <button 
                            onClick={() => paginate(currentPage + 1)} 
                            disabled={currentPage === Math.ceil(leaderboardData.length / usersPerPage)}
                            className="pagination-button"
                        >
                            »
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};

export default E_Leaderboard;