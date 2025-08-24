import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import '../../styles/employee/E_Assessment.css';
import { FaBook, FaClipboardList, FaArrowLeft, FaLock } from 'react-icons/fa';
import LoadingOverlay from '../../components/LoadingOverlay';

const API_URL = 'http://localhost:8081';

const TakeAssessments = () => {
    const { assessmentId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { workstreamId, chapterId } = location.state || {};
    
    console.log('TakeAssessment - Received location.state:', location.state);
    console.log('TakeAssessment - Extracted values:', { workstreamId, chapterId });
    const [assessment, setAssessment] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [showResultsModal, setShowResultsModal] = useState(false);
    const [assessmentResults, setAssessmentResults] = useState(null);
    const [workstreamInfo, setWorkstreamInfo] = useState(null);
    const [isFinalAssessment, setIsFinalAssessment] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(0);
    const questionsPerPage = 1;

    useEffect(() => {
        const fetchAssessmentData = async () => {
            setIsLoading(true);
            try {
                // Check if user has completed this assessment with perfect score
                const userId = localStorage.getItem('userId');
                if (userId) {
                    try {
                        console.log(`Checking perfect score for assessment ${assessmentId}, user ${userId}`);
                        const perfectScoreResponse = await axios.get(`${API_URL}/employee/assessment/${assessmentId}/perfect-score?userId=${userId}`);
                        
                        console.log('Perfect score response:', perfectScoreResponse.data);
                        
                        if (perfectScoreResponse.data.completed_with_perfect_score) {
                            // Redirect back with completion message
                            alert('You have already completed this assessment with a perfect score. Access is no longer available.');
                            if (workstreamId && chapterId) {
                                navigate(`/employee/modules/${workstreamId}`, {
                                    state: { chapterId: chapterId, refresh: true }
                                });
                            } else {
                                navigate('/employee/modules');
                            }
                            return;
                        }
                    } catch (perfectScoreErr) {
                        console.log('Assessment not completed with perfect score or error checking:', perfectScoreErr);
                        console.log('Perfect score error response:', perfectScoreErr.response?.data);
                    }
                }

                const assessmentRes = await axios.get(`${API_URL}/assessments/${assessmentId}`);
                setAssessment(assessmentRes.data);

                const questionsRes = await axios.get(`${API_URL}/assessments/${assessmentId}/questions`);
                setQuestions(questionsRes.data);

                // Check if this is a final assessment and get workstream info
                if (chapterId && workstreamId) {
                    const chapterRes = await axios.get(`${API_URL}/employee/chapters/${chapterId}`);
                    const chapter = chapterRes.data.chapter;
                    
                    if (chapter && chapter.title && chapter.title.toLowerCase().includes('final assessment')) {
                        setIsFinalAssessment(true);
                        
                        // Get workstream info
                        const workstreamRes = await axios.get(`${API_URL}/employee/workstreams/${workstreamId}`);
                        setWorkstreamInfo(workstreamRes.data);
                    }
                }
            } catch (err) {
                setError('Failed to load assessment data.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssessmentData();
    }, [assessmentId, chapterId, workstreamId]);


    const handleAnswerChange = (questionId, answer) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    const renderQuestionInputs = (q) => {
        // Use both 'answers' and 'options' arrays with fallback logic
        let optionsToRender = [];
        
        // Try to get options from multiple sources
        if (Array.isArray(q.answers) && q.answers.length > 0) {
            optionsToRender = q.answers;
        } else if (Array.isArray(q.options) && q.options.length > 0) {
            // Convert options array to answers format
            optionsToRender = q.options.map((optionText, index) => ({
                answer_id: index + 1,
                answer_text: optionText.toString()
            }));
        }

        console.log(`Rendering question ${q.question_id}:`, {
            question_type: q.question_type,
            answers: q.answers,
            options: q.options,
            optionsToRender: optionsToRender
        });

        switch (q.question_type) {
            case 'multiple_choice':
            case 'true_false':
                if (optionsToRender.length === 0) {
                    return <p className="error-message">No options available for this question.</p>;
                }
                return optionsToRender.map((option, index) => (
                    <label key={option.answer_id || index} className="option-label">
                        <input 
                            type="radio" 
                            name={`question-${q.question_id}`} 
                            value={option.answer_text}
                            checked={answers[q.question_id] === option.answer_text}
                            onChange={() => handleAnswerChange(q.question_id, option.answer_text)} 
                        />
                        {option.answer_text}
                    </label>
                ));
            case 'short_answer':
            case 'identification':
                return (
                    <input 
                        type="text" 
                        className="identification-input" 
                        name={`question-${q.question_id}`}
                        value={answers[q.question_id] || ''}
                        onChange={(e) => handleAnswerChange(q.question_id, e.target.value)}
                        placeholder="Type your answer here" 
                    />
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
            question_id: parseInt(questionId, 10),
            answer: answer
        }));

        console.log('Submitting assessment:', {
            assessmentId,
            userId: parseInt(userId, 10),
            answers: formattedAnswers
        });

        setIsLoading(true);
        try {
            const response = await axios.post(`${API_URL}/assessments/${assessmentId}/submit`, {
                user_id: parseInt(userId, 10),
                answers: formattedAnswers
            });
            
            console.log('Submission response:', response.data);
            
            const { totalScore, correctAnswers, totalQuestions, percentage, message, success } = response.data;

            // Show results modal instead of alert
            setAssessmentResults({
                message,
                correctAnswers,
                totalQuestions,
                totalScore,
                percentage,
                passed: percentage >= 75
            });
            setShowResultsModal(true);
        } catch (error) {
            console.error('Failed to submit assessment:', error);
            console.error('Error response:', error.response?.data);
            
            // Handle perfect score lock specifically
            if (error.response?.status === 403 && error.response?.data?.locked) {
                alert('This assessment is locked because you already achieved a perfect score (100%). Retaking assessments with perfect scores is not allowed.');
                // Navigate back to modules
                navigate(`/employee/modules/${workstreamId}`, {
                    state: { 
                        chapterId: chapterId,
                        workstreamId: workstreamId,
                        refresh: true
                    }
                });
                return;
            }
            
            let errorMessage = 'Failed to submit assessment. Please try again.';
            if (error.response?.data?.details) {
                errorMessage += `\n\nError details: ${error.response.data.details}`;
            } else if (error.response?.data?.error) {
                errorMessage += `\n\nError: ${error.response.data.error}`;
            }
            
            alert(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };


    const totalPages = Math.ceil(questions.length / questionsPerPage);
    const currentQuestions = questions.slice(currentPage * questionsPerPage, (currentPage + 1) * questionsPerPage);
    const progress = ((currentPage + 1) / totalPages) * 100;

    if (isLoading) return <LoadingOverlay loading={true} />;
    if (error) return <div className="error-message">{error}</div>;

    const handleBackToChapter = async () => {
        console.log('TakeAssessment - handleBackToChapter called with:', { chapterId, workstreamId });
        
        try {
            // Check if this is a final assessment by fetching the chapter details
            console.log('Fetching chapter details for chapterId:', chapterId);
            const chapterResponse = await axios.get(`${API_URL}/employee/chapters/${chapterId}`);
            const chapter = chapterResponse.data.chapter;
            
            console.log('Chapter details received:', chapter);
            console.log('Chapter title:', chapter?.title);
            console.log('Is final assessment?', chapter?.title?.toLowerCase().includes('final assessment'));
            
            // If this is a final assessment, navigate to the last regular chapter
            if (chapter && chapter.title && chapter.title.toLowerCase().includes('final assessment')) {
                console.log('Detected final assessment, fetching all chapters for workstream:', workstreamId);
                
                // Fetch all chapters in the workstream to find the last regular chapter
                const chaptersResponse = await axios.get(`${API_URL}/employee/workstreams/${workstreamId}/chapters`);
                const chapters = chaptersResponse.data;
                
                console.log('All chapters in workstream:', chapters);
                
                // Find the last regular chapter (not a final assessment)
                const regularChapters = chapters.filter(ch => !ch.title.toLowerCase().includes('final assessment'));
                console.log('Regular chapters (filtered):', regularChapters);
                
                const lastRegularChapter = regularChapters[regularChapters.length - 1];
                console.log('Last regular chapter:', lastRegularChapter);
                
                if (lastRegularChapter) {
                    console.log('Navigating to last regular chapter:', lastRegularChapter.chapter_id);
                    navigate(`/employee/modules/${workstreamId}`, {
                        state: { 
                            chapterId: lastRegularChapter.chapter_id,
                            workstreamId: workstreamId,
                            refresh: true
                        }
                    });
                    return;
                } else {
                    console.log('No regular chapters found, falling back to default behavior');
                }
            } else {
                console.log('Not a final assessment, using regular navigation');
            }
        } catch (error) {
            console.error('Error checking chapter type:', error);
            console.error('Error details:', error.response?.data);
        }
        
        // Fallback to regular behavior for non-final assessments or on error
        console.log('Using fallback navigation to chapterId:', chapterId);
        navigate(`/employee/modules/${workstreamId}`, {
            state: { 
                chapterId: chapterId,
                workstreamId: workstreamId,
                refresh: true
            }
        });
    };

    const handleCloseResultsModal = async () => {
        setShowResultsModal(false);
        
        // For final assessments that are passed, navigate back to workstreams list
        if (isFinalAssessment && assessmentResults?.passed) {
            navigate('/employee/modules');
        } else if (isFinalAssessment && !assessmentResults?.passed) {
            // For failed final assessments, navigate to the last regular chapter
            try {
                const chaptersResponse = await axios.get(`${API_URL}/employee/workstreams/${workstreamId}/chapters`);
                const chapters = chaptersResponse.data;
                
                // Find the last regular chapter (not a final assessment)
                const regularChapters = chapters.filter(ch => !ch.title.toLowerCase().includes('final assessment'));
                const lastRegularChapter = regularChapters[regularChapters.length - 1];
                
                if (lastRegularChapter) {
                    navigate(`/employee/modules/${workstreamId}`, {
                        state: { 
                            refresh: true, 
                            chapterId: lastRegularChapter.chapter_id,
                            workstreamId: workstreamId,
                            assessmentPassed: assessmentResults?.passed
                        }
                    });
                } else {
                    // Fallback to regular navigation if no regular chapters found
                    navigate(`/employee/modules/${workstreamId}`, {
                        state: { 
                            refresh: true, 
                            chapterId: chapterId,
                            workstreamId: workstreamId,
                            assessmentPassed: assessmentResults?.passed
                        }
                    });
                }
            } catch (error) {
                console.error('Error fetching chapters for failed final assessment navigation:', error);
                // Fallback to regular navigation on error
                navigate(`/employee/modules/${workstreamId}`, {
                    state: { 
                        refresh: true, 
                        chapterId: chapterId,
                        workstreamId: workstreamId,
                        assessmentPassed: assessmentResults?.passed
                    }
                });
            }
        } else {
            // Navigate back to chapter after closing modal (regular assessments)
            console.log('Regular assessment navigation - chapterId:', chapterId, 'workstreamId:', workstreamId, 'passed:', assessmentResults?.passed);
            navigate(`/employee/modules/${workstreamId}`, {
                state: { 
                    refresh: true, 
                    chapterId: chapterId,
                    workstreamId: workstreamId,
                    assessmentPassed: assessmentResults?.passed
                }
            });
        }
    };

    return (
        <div className="e-assessment-container">
            {/* Main Assessment Content - Full Width */}
            <main className="e-assessment-main-full">
                {/* Header with Back to Chapter button */}

                <div className="e-assessment-card">
                <div className="assessment-header">
                    <button onClick={handleBackToChapter} className="back-to-chapter-btn">
                        <FaArrowLeft /> Back to Chapter
                    </button>
                    <h1 className="assessment-title">{assessment?.title}</h1>
                </div>

                <div className="question-card-new">
                    <form onSubmit={(e) => e.preventDefault()}>
                        {currentQuestions.map((q, index) => (
                            <div key={q.question_id}>
                                <h2 className="question-title-new">Question {currentPage * questionsPerPage + index + 1}:</h2>
                                <p className="question-text-new">{q.question_text || q.question}</p>
                                <div className="options-container-new">
                                    {renderQuestionInputs(q)}
                                </div>
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
                </div>
            </main>

            {/* Results Modal */}
            {showResultsModal && assessmentResults && (
                <div className="modal-overlay">
                    <div className="results-modal">
                        <div className="results-header">
                            <h2 className="results-title">
                                {isFinalAssessment && assessmentResults.passed 
                                    ? `Congrats on finishing the ${workstreamInfo?.title || 'workstream'}!` 
                                    : 'Assessment Complete!'}
                            </h2>
                            <div className={`results-status ${assessmentResults.passed ? 'passed' : 'failed'}`}>
                                {assessmentResults.passed ? '✓ PASSED' : '✗ FAILED'}
                            </div>
                        </div>
                        
                        <div className="results-content">
                            <div className="results-message">
                                {isFinalAssessment && assessmentResults.passed 
                                    ? `You have successfully completed all modules and assessments in this workstream!`
                                    : assessmentResults.message}
                            </div>
                            
                            <div className="results-layout">
                                <div className="circular-progress-container">
                                    <svg className="circular-progress" width="120" height="120" viewBox="0 0 120 120">
                                        <circle
                                            cx="60"
                                            cy="60"
                                            r="50"
                                            fill="none"
                                            stroke="#e5e7eb"
                                            strokeWidth="8"
                                        />
                                        <circle
                                            cx="60"
                                            cy="60"
                                            r="50"
                                            fill="none"
                                            stroke={assessmentResults.passed ? "#10b981" : "#ef4444"}
                                            strokeWidth="8"
                                            strokeLinecap="round"
                                            strokeDasharray={`${2 * Math.PI * 50}`}
                                            strokeDashoffset={`${2 * Math.PI * 50 * (1 - assessmentResults.percentage / 100)}`}
                                            transform="rotate(-90 60 60)"
                                            className="progress-circle"
                                        />
                                    </svg>
                                    <div className="percentage-text">
                                        {assessmentResults.percentage}%
                                    </div>
                                </div>
                                
                                <div className="results-stats">
                                    <div className="stat-item">
                                        <span className="stat-label">Correct Answers:</span>
                                        <span className="stat-value">{assessmentResults.correctAnswers} / {assessmentResults.totalQuestions}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="results-footer">
                            <button onClick={handleCloseResultsModal} className="continue-btn">
                                {isFinalAssessment && assessmentResults.passed 
                                    ? 'Back to Workstreams' 
                                    : 'Continue to Chapter'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TakeAssessments;