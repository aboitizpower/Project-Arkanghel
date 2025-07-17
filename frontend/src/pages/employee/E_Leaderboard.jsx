import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_Leaderboard.css';

const E_Leaderboard = () => {
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const usersPerPage = 10; // You can adjust this number

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const response = await axios.get('http://localhost:8081/leaderboard');
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
                    </div>
                )}
                <div className="pagination-wrapper">
  <div className="pagination-container">
    <button className="pagination-btn" onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
      &laquo;
    </button>
    {Array.from({ length: Math.ceil(leaderboardData.length / usersPerPage) }, (_, i) => (
      <button
        key={i + 1}
        onClick={() => paginate(i + 1)}
        className={`pagination-btn${currentPage === i + 1 ? ' active' : ''}`}
      >
        {i + 1}
      </button>
    ))}
    <button className="pagination-btn" onClick={() => paginate(currentPage + 1)} disabled={currentPage === Math.ceil(leaderboardData.length / usersPerPage)}>
      &raquo;
    </button>
  </div>
</div>
            </main>
        </div>
    );
};

export default E_Leaderboard; 