import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_AssessmentResults.css';
import LoadingOverlay from '../../components/LoadingOverlay';

const API_URL = 'http://localhost:8081';

const E_AssessmentResults = () => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const userId = localStorage.getItem('userId');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const resultsPerPage = 10; // You can adjust this number

    useEffect(() => {
        if (!userId) {
            setError('You must be logged in to view assessment results.');
            setLoading(false);
            return;
        }

        axios.get(`${API_URL}/users/${userId}/assessment-results`)
            .then(response => {
                setResults(response.data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching assessment results:', err);
                setError('Failed to fetch assessment results.');
                setLoading(false);
            });
    }, [userId]);

    // Get current results for pagination
    const indexOfLastResult = currentPage * resultsPerPage;
    const indexOfFirstResult = indexOfLastResult - resultsPerPage;
    const currentResults = results.slice(indexOfFirstResult, indexOfLastResult);

    // Change page
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    return (
        <div className="page-layout">
            <EmployeeSidebar />
            <main className="main-content">
                <LoadingOverlay loading={loading} />
                <div className="page-header">
                    <h1 className="page-title">Assessment Results</h1>
                </div>

                {loading ? (
                    <div className="loading-message">Loading results...</div>
                ) : error ? (
                    <div className="error-message">{error}</div>
                ) : (
                    <div className="table-container">
                        {results.length > 0 ? (
  <>
    <table className="results-table">
                                    <thead>
                                        <tr>
                                            <th>Assessment Title</th>
                                            <th>Your Score</th>
                                            <th>Total Questions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentResults.map(result => (
                                            <tr key={result.assessment_id}>
                                                <td>{result.title}</td>
                                                <td>{result.user_score}</td>
                                                <td>{result.total_questions}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="pagination-wrapper">
                                    <div className="pagination-container">
                                        <button className="pagination-btn" onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
                                            &laquo;
                                        </button>
                                        {Array.from({ length: Math.ceil(results.length / resultsPerPage) }, (_, i) => (
                                            <button
                                                key={i + 1}
                                                onClick={() => paginate(i + 1)}
                                                className={`pagination-btn${currentPage === i + 1 ? ' active' : ''}`}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}
                                        <button className="pagination-btn" onClick={() => paginate(currentPage + 1)} disabled={currentPage === Math.ceil(results.length / resultsPerPage)}>
                                            &raquo;
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p>You have not completed any assessments yet.</p>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default E_AssessmentResults;
