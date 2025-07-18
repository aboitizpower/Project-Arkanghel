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
    const [isLoading, setIsLoading] = useState(true);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(0);
    const questionsPerPage = 1;

    useEffect(() => {
        const fetchAssessmentData = async () => {
            setIsLoading(true);
            try {
                const assessmentRes = await axios.get(`${API_URL}/assessments/${assessmentId}`);
                setAssessment(assessmentRes.data);

                const questionsRes = await axios.get(`${API_URL}/assessments/${assessmentId}/questions`);
                const processedQuestions = questionsRes.data.map(q => ({
                    ...q,
                    options: typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []),
                    question_text: q.question_text || q.question
                }));
                setQuestions(processedQuestions);
            } catch (err) {
                setError('Failed to load assessment data.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssessmentData();
    }, [assessmentId]);

    // Fetch sidebar data
    useEffect(() => {
        const fetchSidebarData = async () => {
            if (!workstreamId) return;
            try {
                const wsRes = await axios.get(`${API_URL}/employee/workstreams?userId=${localStorage.getItem('userId')}`);
                const ws = wsRes.data.find(w => w.workstream_id === workstreamId);
                setWorkstream(ws);
                const chaptersRes = await axios.get(`${API_URL}/employee/workstreams/${workstreamId}/chapters`);
                setChapters(chaptersRes.data);
                const progressRes = await axios.get(`${API_URL}/user-progress/${localStorage.getItem('userId')}/${workstreamId}`);
                const completedIds = progressRes.data.map(item => item.chapter_id);
                setCompletedChapters(new Set(completedIds));
            } catch (err) {
                console.error('Sidebar fetch error:', err);
            }
        };
        fetchSidebarData();
    }, [workstreamId]);

    const handleAnswerChange = (questionId, answer) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    const renderQuestionInputs = (q) => {
        const options = Array.isArray(q.options) ? q.options : [];
        switch (q.question_type) {
            case 'multiple_choice':
                return options.map((option, index) => (
                    <label key={index} className="option-label">
                        <input type="radio" name={`question-${q.question_id}`} value={option}
                               checked={answers[q.question_id] === option}
                               onChange={() => handleAnswerChange(q.question_id, option)} />
                        {option}
                    </label>
                ));
            case 'true_false':
                return ['True', 'False'].map(option => (
                    <label key={option} className="option-label">
                        <input type="radio" name={`question-${q.question_id}`} value={option}
                               checked={answers[q.question_id] === option}
                               onChange={() => handleAnswerChange(q.question_id, option)} />
                        {option}
                    </label>
                ));
            case 'short_answer':
            case 'identification':
                return (
                    <input type="text" className="identification-input" name={`question-${q.question_id}`}
                           value={answers[q.question_id] || ''}
                           onChange={(e) => handleAnswerChange(q.question_id, e.target.value)}
                           placeholder="Type your answer here" />
                );
            default:
                return <p>Unsupported question type: {q.question_type}</p>;
        }
    };

    const handleSubmit = async () => {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            alert('You must be logged in to submit.');
            return;
        }
        if (Object.keys(answers).length !== questions.length) {
            alert('Please answer all questions before submitting.');
            return;
        }

        const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
            questionId: parseInt(questionId, 10),
            answer
        }));

        setIsLoading(true);
        try {
            const response = await axios.post(`${API_URL}/answers`, {
                userId: parseInt(userId, 10),
                answers: formattedAnswers,
                assessmentId: parseInt(assessmentId, 10)
            });
            const { totalScore, totalQuestions } = response.data;
            alert(`Assessment submitted! You scored ${totalScore} out of ${totalQuestions}.`);
            navigate('/employee/modules', { state: { workstreamId, chapterId, refresh: Date.now() } });
        } catch (err) {
            setError('Failed to submit assessment.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectChapter = (ch) => {
        const chapterIndex = chapters.findIndex(c => c.chapter_id === ch.chapter_id);
        if (chapterIndex > 0 && !completedChapters.has(chapters[chapterIndex - 1].chapter_id)) {
            return;
        }
        navigate('/employee/modules', { state: { workstreamId, chapterId: ch.chapter_id, refresh: Date.now() } });
    };

    const totalPages = Math.ceil(questions.length / questionsPerPage);
    const currentQuestions = questions.slice(currentPage * questionsPerPage, (currentPage + 1) * questionsPerPage);
    const progress = ((currentPage + 1) / totalPages) * 100;

    if (isLoading) return <LoadingOverlay loading={true} />;
    if (error) return <div className="error-message">{error}</div>;

    const regularChapters = chapters.filter(c => !c.title?.toLowerCase().includes('final assessment'));
    const finalAssessmentChapter = chapters.find(c => c.title?.toLowerCase().includes('final assessment'));
    const areAllChaptersComplete = regularChapters.every(c => completedChapters.has(c.chapter_id));

    return (
        <div className="e-assessment-container">
            {/* Sidebar */}
            <div className="module-view-sidebar">
                <div className="module-view-header">
                    <button onClick={() => navigate('/employee/modules', { state: { workstreamId } })} className="back-to-ws-btn">
                        <FaArrowLeft /><span>Back to Workstreams</span>
                    </button>
                    <h2>{workstream?.title}</h2>
                </div>
                <div className="chapter-list-container">
                    <ul className="chapter-list">
                        {regularChapters.map((ch, index) => {
                            const isLocked = index > 0 && !completedChapters.has(regularChapters[index - 1].chapter_id);
                            return (
                                <li key={ch.chapter_id} className={`chapter-list-item ${chapterId === ch.chapter_id ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                                    onClick={() => !isLocked && handleSelectChapter(ch)}>
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
                                    <li key={finalAssessmentChapter.chapter_id}
                                        className={`chapter-list-item ${chapterId === finalAssessmentChapter.chapter_id ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                                        onClick={() => !isLocked && handleSelectChapter(finalAssessmentChapter)}>
                                        <div className="chapter-icon">{isLocked ? <FaLock /> : <FaClipboardList />}</div>
                                        <span className="chapter-title">{finalAssessmentChapter.title}</span>
                                    </li>
                                );
                            })()}
                        </ul>
                    </div>
                )}
            </div>

            {/* Main Assessment Content */}
            <main className="e-assessment-main-new">
                <div className="question-card-new">
                    <form onSubmit={(e) => e.preventDefault()}>
                        {currentQuestions.map((q, index) => (
                            <div key={q.question_id}>
                                <h2 className="question-title-new">Question {currentPage * questionsPerPage + index + 1}:</h2>
                                <p className="question-text-new">{q.question_text}</p>
                                <div className="options-container-new">{renderQuestionInputs(q)}</div>
                            </div>
                        ))}
                        <div className="assessment-navigation-new">
                            <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0} className="prev-btn-new">
                                Previous Question
                            </button>
                            {currentPage < totalPages - 1 ? (
                                <button onClick={() => setCurrentPage(p => p + 1)} className="submit-btn-new">
                                    Next Question
                                </button>
                            ) : (
                                <button onClick={handleSubmit} className="submit-btn-new">
                                    Submit
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default E_Assessment;