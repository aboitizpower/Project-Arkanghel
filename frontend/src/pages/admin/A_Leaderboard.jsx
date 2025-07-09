import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/employee/E_Leaderboard.css';

const A_Leaderboard = () => {
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

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

    return (
        <div className="a-leaderboard-container">
            <AdminSidebar />
            <main className="a-leaderboard-main-content">
                {isLoading ? (
                    <div className="loading-message">Loading leaderboard...</div>
                ) : error ? (
                    <div className="error-message">{error}</div>
                ) : (
                    <div className="leaderboard-table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Employee</th>
                                    <th>Overall Progress</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboardData.map((user, index) => (
                                    <tr key={user.user_id}>
                                        <td className="rank-cell">{index + 1}</td>
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
            </main>
        </div>
    );
};

export default A_Leaderboard; 