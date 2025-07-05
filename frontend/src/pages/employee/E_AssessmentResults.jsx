import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_AssessmentResults.css';

const API_URL = 'http://localhost:8081';

const E_AssessmentResults = () => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const userId = localStorage.getItem('userId');

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

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="e-assessment-results-container">
            <EmployeeSidebar />
            <main className="page-container">
                <h1>My Assessment Results</h1>
                {results.length > 0 ? (
                    <table className="results-table">
                        <thead>
                            <tr>
                                <th>Assessment Title</th>
                                <th>Your Score</th>
                                <th>Total Questions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map(result => (
                                <tr key={result.assessment_id}>
                                    <td>{result.title}</td>
                                    <td>{result.user_score}</td>
                                    <td>{result.total_questions}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p>You have not completed any assessments yet.</p>
                )}
            </main>
        </div>
    );
};

export default E_AssessmentResults;
