import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_Assessment.css';
import { FaBook, FaClipboardList, FaArrowLeft, FaLock } from 'react-icons/fa';
import LoadingOverlay from '../../components/LoadingOverlay';

const API_URL = 'http://localhost:8081';

const E_Assessment = () => {
    const { assessmentId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { workstreamId, chapterId } = location.state || {};
    const [assessment, setAssessment] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [error, setError] = useState('');
    const [workstream, setWorkstream] = useState(null);
    const [chapters, setChapters] = useState([]);
    const [completedChapters, setCompletedChapters] = useState(new Set());

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

    useEffect(() => {
        // Fetch workstream and chapters for sidebar
        const fetchSidebarData = async () => {
            if (!workstreamId) return;
            try {
                const wsRes = await axios.get(`${API_URL}/employee/workstreams?userId=${localStorage.getItem('userId')}`);
                const ws = wsRes.data.find(w => w.workstream_id === workstreamId);
                setWorkstream(ws);
                const chaptersRes = await axios.get(`${API_URL}/employee/workstreams/${workstreamId}/chapters`);
                setChapters(chaptersRes.data);
                // Fetch completed chapters
                const progressRes = await axios.get(`${API_URL}/user-progress/${localStorage.getItem('userId')}/${workstreamId}`);
                const completedIds = progressRes.data.map(item => item.chapter_id);
                setCompletedChapters(new Set(completedIds));
            } catch (err) {
                // Sidebar is not critical, so don't block assessment
                console.error('Sidebar fetch error:', err);
            }
        };
        fetchSidebarData();
    }, [workstreamId]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

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
            const { totalScore, totalQuestions } = response.data;
            alert(`Assessment submitted successfully!\n\nYou scored ${totalScore} out of ${totalQuestions}.`);
            
            navigate('/employee/modules', { 
                state: { 
                    workstreamId, 
                    chapterId,
                    refresh: Date.now()
                } 
            });
        } catch (err) {
            setError('Failed to submit assessment.');
            console.error(err);
        }
    };

    const handleSelectChapter = (ch) => {
        // Only allow navigation to unlocked chapters
        const chapterIndex = chapters.findIndex(c => c.chapter_id === ch.chapter_id);
        if (chapterIndex > 0 && !completedChapters.has(chapters[chapterIndex - 1].chapter_id)) {
            return;
        }
        navigate('/employee/modules', {
            state: {
                workstreamId,
                chapterId: ch.chapter_id,
                refresh: Date.now()
            }
        });
    };

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    if (!assessment) {
        return <div>Loading assessment...</div>;
    }

    // Sidebar logic
    const regularChapters = chapters.filter(c => !c.title?.toLowerCase().includes('final assessment'));
    const finalAssessmentChapter = chapters.find(c => c.title?.toLowerCase().includes('final assessment'));
    const areAllChaptersComplete = regularChapters.every(c => completedChapters.has(c.chapter_id));

    return (
        <div className="e-assessment-container" style={{ display: 'flex' }}>
            {/* Chapter Sidebar */}
            <div className="module-view-sidebar">
                <div className="module-view-header">
                    <button onClick={() => navigate('/employee/modules', { state: { workstreamId } })} className="back-to-ws-btn">
                        <FaArrowLeft />
                        <span>Back to Workstreams</span>
                    </button>
                    <h2>{workstream?.title}</h2>
                </div>
                <div className="chapter-list-container">
                    <ul className="chapter-list">
                        {regularChapters.map((ch, index) => {
                            const isLocked = index > 0 && !completedChapters.has(regularChapters[index - 1].chapter_id);
                            return (
                                <li
                                    key={ch.chapter_id}
                                    className={`chapter-list-item ${chapterId === ch.chapter_id ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                                    onClick={() => !isLocked && handleSelectChapter(ch)}
                                >
                                    <div className="chapter-icon">{isLocked ? <FaLock /> : <FaBook />}</div>
                                    <span className="chapter-title">{ch.title}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                {finalAssessmentChapter && (
                    <div className="final-assessment-nav-section">
                        <ul className="chapter-list">
                            {(() => {
                                const isLocked = !areAllChaptersComplete;
                                return (
                                    <li
                                        key={finalAssessmentChapter.chapter_id}
                                        className={`chapter-list-item ${chapterId === finalAssessmentChapter.chapter_id ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                                        onClick={() => !isLocked && handleSelectChapter(finalAssessmentChapter)}
                                    >
                                        <div className="chapter-icon">{isLocked ? <FaLock /> : <FaClipboardList />}</div>
                                        <span className="chapter-title">{finalAssessmentChapter.title}</span>
                                    </li>
                                );
                            })()}
                        </ul>
                    </div>
                )}
            </div>
            {/* Assessment Content */}
            <main className="assessment-main-content">
                <LoadingOverlay loading={!assessment || questions.length === 0} />
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