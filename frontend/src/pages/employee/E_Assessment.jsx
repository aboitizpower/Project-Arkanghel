import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_Assessment.css';

const API_URL = 'http://localhost:8081';

const E_Assessment = () => {
    const { assessmentId } = useParams();
    const navigate = useNavigate();
    const [assessment, setAssessment] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchAssessmentData = async () => {
            try {
                const assessmentRes = await axios.get(`${API_URL}/assessments/${assessmentId}`);
                setAssessment(assessmentRes.data);

                const questionsRes = await axios.get(`${API_URL}/assessments/${assessmentId}/questions`);
                setQuestions(questionsRes.data);
            } catch (err) {
                setError('Failed to load assessment data.');
                console.error(err);
            }
        };

        fetchAssessmentData();
    }, [assessmentId]);

    const handleAnswerChange = (questionId, answer) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    const renderQuestionInputs = (q) => {
        switch (q.question_type) {
            case 'Multiple Choice':
                if (!Array.isArray(q.options)) {
                    return <p>Options are not available for this question.</p>;
                }
                return q.options.map((option, index) => (
                    <label key={index} className="option-label">
                        <input
                            type="radio"
                            name={`question-${q.question_id}`}
                            value={option}
                            checked={answers[q.question_id] === option}
                            onChange={() => handleAnswerChange(q.question_id, option)}
                            required
                        />
                        {option}
                    </label>
                ));
            case 'True or False':
                return ['True', 'False'].map(option => (
                    <label key={option} className="option-label">
                        <input 
                            type="radio" 
                            name={`question-${q.question_id}`} 
                            value={option}
                            checked={answers[q.question_id] === option}
                            onChange={() => handleAnswerChange(q.question_id, option)}
                            required
                        />
                        {option}
                    </label>
                ));
            case 'Identification':
                return (
                    <input 
                        type="text"
                        className="identification-input"
                        name={`question-${q.question_id}`}
                        value={answers[q.question_id] || ''}
                        onChange={(e) => handleAnswerChange(q.question_id, e.target.value)}
                        placeholder="Type your answer here"
                        required
                    />
                );
            default:
                return <p>Unsupported question type: {q.question_type}</p>;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const userId = localStorage.getItem('userId');
        if (!userId) {
            alert('You must be logged in to submit an assessment.');
            return;
        }

        const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
            questionId: parseInt(questionId, 10),
            answer: answer
        }));

        if (formattedAnswers.length !== questions.length) {
            alert('Please answer all questions before submitting.');
            return;
        }

        try {
            const response = await axios.post(`${API_URL}/answers`, { 
                userId: parseInt(userId, 10), 
                answers: formattedAnswers,
                assessmentId: parseInt(assessmentId, 10)
            });
            const { totalScore } = response.data;
            const totalQuestions = formattedAnswers.length;
            alert(`Assessment submitted successfully!\n\nYou scored ${totalScore} out of ${totalQuestions}.`);
            navigate('/employee/modules'); // Navigate back to modules page
        } catch (err) {
            setError('Failed to submit assessment.');
            console.error(err);
        }
    };

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    if (!assessment) {
        return <div>Loading assessment...</div>;
    }

    return (
        <div className="e-assessment-container">
            <EmployeeSidebar />
            <main className="page-container">
                <h1>{assessment.title}</h1>
                <p>{assessment.description}</p>
                <form onSubmit={handleSubmit} className="assessment-form">
                    {questions.map((q, index) => (
                        <div key={q.question_id} className="question-card">
                            <p className="question-text">{index + 1}. {q.question_text}</p>
                            <div className="options-container">
                                {renderQuestionInputs(q)}
                            </div>
                        </div>
                    ))}
                    <button type="submit" className="submit-btn">Submit Assessment</button>
                </form>
            </main>
        </div>
    );
};

export default E_Assessment;