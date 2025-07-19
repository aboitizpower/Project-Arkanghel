import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_AssessmentResults.css';
import '../../styles/employee/EmployeeCommon.css';
import LoadingOverlay from '../../components/LoadingOverlay';

const API_URL = 'http://localhost:8081';

const E_AssessmentResults = () => {
    const [results, setResults] = useState([]);
    const [workstreams, setWorkstreams] = useState([]);
    const [selectedWorkstream, setSelectedWorkstream] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const userId = localStorage.getItem('userId');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const resultsPerPage = 10;

    // Fetch workstreams for filter
    useEffect(() => {
        if (!userId) return;
        axios.get(`${API_URL}/employee/workstreams?userId=${userId}`)
            .then(res => setWorkstreams(res.data))
            .catch(() => setWorkstreams([]));
    }, [userId]);

    // Fetch assessment results
    useEffect(() => {
        if (!userId) {
            setError('You must be logged in to view assessment results.');
            setLoading(false);
            return;
        }
        setLoading(true);
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

    // Filter by workstream
    const filteredResults = selectedWorkstream
        ? results.filter(r => r.workstream_id === parseInt(selectedWorkstream))
        : results;

    // Pagination
    const indexOfLastResult = currentPage * resultsPerPage;
    const indexOfFirstResult = indexOfLastResult - resultsPerPage;
    const currentResults = filteredResults.slice(indexOfFirstResult, indexOfLastResult);
    const totalPages = Math.ceil(filteredResults.length / resultsPerPage) || 1;

    // Header info (if only one assessment is shown)
    let headerAssessment = null;
    if (filteredResults.length === 1) headerAssessment = filteredResults[0];

    // Change page
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    // Table: Only show highest score per assessment (already handled by backend)
    return (
        <div className="page-layout">
            <EmployeeSidebar />
            <main className="main-content">
                <LoadingOverlay loading={loading} />
                <div className="page-header assessment-header-ui employee-white-container">
                    <h2 className="page-title" style={{ fontSize: '1.35rem', fontWeight: 700 }}>Assessment Results</h2>
                    <div className="workstream-filter-container compact-filter">
                        <label htmlFor="workstream-filter" className="workstream-filter-label">Workstream Filter</label>
                    <select
                            id="workstream-filter"
                        className="workstream-filter-dropdown"
                        value={selectedWorkstream}
                        onChange={e => { setSelectedWorkstream(e.target.value); setCurrentPage(1); }}
                    >
                        <option value="">All Workstreams</option>
                        {workstreams.map(ws => (
                            <option key={ws.workstream_id} value={ws.workstream_id}>{ws.title}</option>
                        ))}
                    </select>
                    </div>
                </div>
                <div className="table-container employee-white-container">
                    <table className="results-table">
                        <thead>
                            <tr>
                                <th>Assessment Name</th>
                                <th>Assessment Score</th>
                                <th>Attempts Taken</th>
                                <th>Pass/Fail</th>
                                <th>Last Date Taken</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} className="no-data-row">Loading...</td></tr>
                            ) : error ? (
                                <tr><td colSpan={5} className="no-data-row">{error}</td></tr>
                            ) : filteredResults.length === 0 ? (
                                <tr><td colSpan={5} className="no-data-row">No assessment results found for this workstream</td></tr>
                            ) : (
                                currentResults.map(result => (
                                    <tr key={result.assessment_id}>
                                        <td>{result.assessment_title}</td>
                                        <td style={{ fontWeight: 600 }}>{result.user_score ?? '-'} / {result.total_points ?? '-'}</td>
                                        <td>{result.attempts ?? '-'}</td>
                                        <td>{typeof result.passed === 'boolean' ? (result.passed ? '✅ Pass' : '❌ Fail') : '-'}</td>
                                        <td>{result.last_date_taken ? new Date(result.last_date_taken).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {filteredResults.length > resultsPerPage && !loading && !error && (
                        <div className="pagination-controls">
                            <button className="pagination-btn" onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
                                &laquo;
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => (
                                <button
                                    key={i + 1}
                                    onClick={() => paginate(i + 1)}
                                    className={`pagination-btn${currentPage === i + 1 ? ' active' : ''}`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button className="pagination-btn" onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}>
                                &raquo;
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default E_AssessmentResults;
