import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_Assessment.css';
import '../../styles/employee/EmployeeCommon.css';
import LoadingOverlay from '../../components/LoadingOverlay';
import { FaHistory } from 'react-icons/fa';

const API_URL = 'http://localhost:8081';

const E_Assessments = () => {
    const [results, setResults] = useState([]);
    const [workstreams, setWorkstreams] = useState([]);
    const [selectedWorkstream, setSelectedWorkstream] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAttemptsModal, setShowAttemptsModal] = useState(false);
    const [selectedAssessmentAttempts, setSelectedAssessmentAttempts] = useState([]);
    const [attemptsLoading, setAttemptsLoading] = useState(false);
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
        axios.get(`${API_URL}/employee/assessment-results/${userId}`)
            .then(response => {
                console.log('Assessment results response:', response.data);
                console.log('First result object:', response.data[0]);
                console.log('Score vs Passing Score:', response.data[0]?.score, 'vs', response.data[0]?.passing_score);
                setResults(Array.isArray(response.data) ? response.data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching assessment results:', err);
                setError('Failed to fetch assessment results.');
                setResults([]);
                setLoading(false);
            });
    }, [userId]);

    // Filter by workstream - ensure results is always an array
    const safeResults = Array.isArray(results) ? results : [];
    const filteredResults = selectedWorkstream
        ? safeResults.filter(r => r.workstream_id === parseInt(selectedWorkstream))
        : safeResults;

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

    // Fetch attempts for a specific assessment
    const fetchAssessmentAttempts = async (assessmentId) => {
        setAttemptsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/employee/assessment-attempts/${userId}/${assessmentId}`);
            setSelectedAssessmentAttempts(Array.isArray(response.data) ? response.data : []);
            setShowAttemptsModal(true);
        } catch (err) {
            console.error('Error fetching assessment attempts:', err);
            setSelectedAssessmentAttempts([]);
            setShowAttemptsModal(true);
        } finally {
            setAttemptsLoading(false);
        }
    };

    // Close attempts modal
    const closeAttemptsModal = () => {
        setShowAttemptsModal(false);
        setSelectedAssessmentAttempts([]);
    };

    // Table: Only show highest score per assessment (already handled by backend)
    return (
        <div className="page-layout">
            <EmployeeSidebar />
            <main className="main-content">
                <LoadingOverlay loading={loading} />
                <div className="page-header">
                    <h1 className="page-title">Assessment Results</h1>
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
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="no-data-row">Loading...</td></tr>
                            ) : error ? (
                                <tr><td colSpan={6} className="no-data-row">{error}</td></tr>
                            ) : filteredResults.length === 0 ? (
                                <tr><td colSpan={6} className="no-data-row">No assessment results found for this workstream</td></tr>
                            ) : (
                                currentResults.map(result => (
                                    <tr key={result.assessment_id}>
                                        <td>{result.assessment_title}</td>
                                        <td style={{ fontWeight: 600 }}>{result.score ?? '-'} / {result.total_questions ?? result.total_points ?? '-'}</td>
                                        <td>{result.total_attempts ?? '-'}</td>
                                        <td>{result.passed === 1 ? 'PASS' : 'FAIL'}</td>
                                        <td>{result.completed_at ? new Date(result.completed_at).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true }) : '-'}</td>
                                        <td>
                                            <button 
                                                className="view-attempts-btn"
                                                onClick={() => fetchAssessmentAttempts(result.assessment_id)}
                                                title="View Previous Attempts"
                                            >
                                                <FaHistory />
                                            </button>
                                        </td>
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

                {/* Attempts Modal */}
                {showAttemptsModal && (
                    <div className="modal-overlay" onClick={closeAttemptsModal}>
                        <div className="attempts-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Previous Attempts</h3>
                                <button className="modal-close-btn" onClick={closeAttemptsModal}>&times;</button>
                            </div>
                            <div className="modal-body">
                                {attemptsLoading ? (
                                    <p>Loading attempts...</p>
                                ) : selectedAssessmentAttempts.length === 0 ? (
                                    <p>No previous attempts found for this assessment.</p>
                                ) : (
                                    <table className="attempts-table">
                                        <thead>
                                            <tr>
                                                <th>Attempt #</th>
                                                <th>Score</th>
                                                <th>Result</th>
                                                <th>Date Taken</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedAssessmentAttempts.map((attempt, index) => (
                                                <tr key={index}>
                                                    <td>{index + 1}</td>
                                                    <td>{attempt.score ?? '-'} / {attempt.total_questions ?? attempt.total_points ?? '-'}</td>
                                                    <td className={attempt.passed ? 'pass-result' : 'fail-result'}>
                                                        {attempt.passed ? 'PASS' : 'FAIL'}
                                                    </td>
                                                    <td>{attempt.completed_at ? new Date(attempt.completed_at).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }) : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default E_Assessments;
