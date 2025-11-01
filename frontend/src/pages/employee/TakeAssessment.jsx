import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import '../../styles/employee/E_Assessment.css';
import { FaBook, FaClipboardList, FaArrowLeft, FaLock, FaCertificate } from 'react-icons/fa';
import LoadingOverlay from '../../components/LoadingOverlay';
import { useAuth } from '../../auth/AuthProvider';

import API_URL from '../../config/api';

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
    const [deadline, setDeadline] = useState(null);
    const [isExpired, setIsExpired] = useState(false);
    const [showCertificateModal, setShowCertificateModal] = useState(false);
    const [certificateData, setCertificateData] = useState(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(0);
    const questionsPerPage = 1;

    const { user } = useAuth();

    useEffect(() => {
        // Don't fetch if no assessmentId is present or if we're not on the assessment route
        if (!assessmentId || !location.pathname.includes('/employee/assessment/')) {
            setIsLoading(false);
            // Don't show error if we're not on the assessment route (component is being unmounted)
            if (location.pathname.includes('/employee/assessment/')) {
                setError('No assessment ID provided');
            }
            return;
        }

        // Create AbortController for request cancellation
        const abortController = new AbortController();
        const signal = abortController.signal;

        const fetchAssessmentData = async () => {
            setIsLoading(true);
            try {
                // Check if user has completed this assessment with perfect score
                if (user?.id) {
                    try {
                        console.log(`Checking perfect score for assessment ${assessmentId}, user ${user.id}`);
                        const perfectScoreResponse = await axios.get(
                            `${API_URL}/employee/assessment/${assessmentId}/perfect-score`,
                            {
                                params: { userId: user.id },
                                headers: { 'Authorization': `Bearer ${user.token}` },
                                signal: signal
                            }
                        );
                        
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

                const assessmentRes = await axios.get(`${API_URL}/assessments/${assessmentId}`, { 
                    signal,
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });
                if (!signal.aborted) {
                    setAssessment(assessmentRes.data);
                    
                    // Check deadline if exists
                    if (assessmentRes.data.deadline) {
                        const deadlineDate = new Date(assessmentRes.data.deadline);
                        const now = new Date();
                        setDeadline(deadlineDate);
                        setIsExpired(now > deadlineDate);
                    }
                }

                const questionsRes = await axios.get(`${API_URL}/assessments/${assessmentId}/questions`, { 
                    signal,
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });
                if (!signal.aborted) {
                    setQuestions(questionsRes.data);
                }

                // Check if this is a final assessment and get workstream info
                if (chapterId && workstreamId) {
                    const chapterRes = await axios.get(`${API_URL}/employee/chapters/${chapterId}`, { 
                        signal,
                        headers: { 'Authorization': `Bearer ${user.token}` }
                    });
                    if (!signal.aborted) {
                        const chapter = chapterRes.data.chapter;
                        
                        console.log('TakeAssessment - Chapter loaded:', {
                            chapterId,
                            title: chapter?.title,
                            lowerCase: chapter?.title?.toLowerCase(),
                            includesFinal: chapter?.title?.toLowerCase().includes('final assessment')
                        });
                        
                        if (chapter && chapter.title && chapter.title.toLowerCase().includes('final assessment')) {
                            console.log('Setting isFinalAssessment to TRUE');
                            setIsFinalAssessment(true);
                            
                            // Get workstream info
                            const workstreamRes = await axios.get(`${API_URL}/employee/workstreams/${workstreamId}`, { 
                                signal,
                                headers: { 'Authorization': `Bearer ${user.token}` }
                            });
                            if (!signal.aborted) {
                                setWorkstreamInfo(workstreamRes.data);
                            }
                        }
                    }
                }
            } catch (err) {
                // Don't set error if request was aborted (component unmounted)
                if (!signal.aborted) {
                    if (err.response?.status === 403 && err.response?.data?.expired) {
                        setError('This assessment deadline has passed. You can no longer take this assessment.');
                        setIsExpired(true);
                    } else {
                        setError('Failed to load assessment data.');
                    }
                    console.error(err);
                }
            } finally {
                if (!signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        fetchAssessmentData();

        // Cleanup function to abort requests when component unmounts
        return () => {
            abortController.abort();
        };
    }, [assessmentId, location.pathname, location.state, user]);

    const handleAnswerChange = (questionId, answer) => {
        console.log(`Answer changed for question ${questionId}:`, answer);
        setAnswers(prev => {
            const newAnswers = { ...prev, [questionId]: answer };
            console.log('Updated answers state:', newAnswers);
            return newAnswers;
        });
    };

    const renderQuestionInputs = (q) => {
        // Use both 'answers' and 'options' arrays with fallback logic
        let optionsToRender = [];
        
        // Special handling for True/False questions - always generate True/False options
        if (q.question_type === 'true_false') {
            optionsToRender = [
                { answer_id: 1, answer_text: 'True' },
                { answer_id: 2, answer_text: 'False' }
            ];
        } else if (Array.isArray(q.answers) && q.answers.length > 0) {
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
                return optionsToRender.map((option, index) => {
                    const isSelected = answers[q.question_id] === option.answer_text;
                    console.log(`Rendering option for question ${q.question_id}:`, {
                        optionText: option.answer_text,
                        currentAnswer: answers[q.question_id],
                        isSelected: isSelected
                    });
                    return (
                        <label 
                            key={option.answer_id || index} 
                            className={`option-label ${isSelected ? 'selected' : ''}`}
                            style={isSelected ? { backgroundColor: '#e7f3ff', borderColor: '#007bff' } : {}}
                        >
                            <input 
                                type="radio" 
                                name={`question-${q.question_id}`} 
                                value={option.answer_text}
                                checked={isSelected}
                                onChange={() => handleAnswerChange(q.question_id, option.answer_text)} 
                            />
                            {option.answer_text}
                        </label>
                    );
                });
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
        if (!user) {
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
            userId: user.id,
            answers: formattedAnswers
        });

        setIsLoading(true);
        try {
            const response = await axios.post(
                `${API_URL}/assessments/${assessmentId}/submit`,
                {
                    user_id: user.id,
                    answers: formattedAnswers
                },
                {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                }
            );
            
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

    const handleFinishAndGetCertificate = async () => {
        try {
            // Prepare certificate data
            const certData = {
                userName: `${user.first_name} ${user.last_name}`,
                workstreamTitle: workstreamInfo?.title || 'Workstream',
                completionDate: new Date(),
                userEmail: user.email,
                workstreamId: workstreamId
            };
            
            setCertificateData(certData);
            setShowCertificateModal(true);
            setShowResultsModal(false);

        } catch (error) {
            console.error('Error preparing certificate:', error);
            alert('Error preparing certificate. Please try again.');
        }
    };

    const handleDownloadCertificate = async () => {
        try {
            const response = await axios.get(`${API_URL}/employee/certificates/${workstreamId}`, {
                params: { userId: user.id },
                responseType: 'blob',
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });

            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            
            // Generate filename
            const filename = `Certificate_${workstreamInfo?.title?.replace(/[^a-zA-Z0-9]/g, '_')}_${user.first_name}_${user.last_name}.pdf`;
            link.setAttribute('download', filename);
            
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error downloading certificate:', error);
            if (error.response?.status === 400) {
                alert('Certificate not available. Please ensure you have completed 100% of the workstream.');
            } else {
                alert('Failed to download certificate. Please try again later.');
            }
        }
    };

    const totalPages = Math.ceil(questions.length / questionsPerPage);
    const currentQuestions = questions.slice(currentPage * questionsPerPage, (currentPage + 1) * questionsPerPage);
    const progress = ((currentPage + 1) / totalPages) * 100;

    // Don't render if we're not on the assessment route (prevents flash during navigation)
    if (!location.pathname.includes('/employee/assessment/')) {
        return null;
    }

    if (isLoading) return <LoadingOverlay loading={true} />;
    if (error) return <div className="error-message">{error}</div>;

    const handleBackToChapter = () => {
        console.log('Take Assessment - handleBackToChapter called with:', { chapterId, workstreamId });
        
        // Immediate navigation without API calls to prevent 404 errors
        if (workstreamId && chapterId) {
            console.log('Navigating immediately to chapter:', chapterId);
            navigate(`/employee/modules/${workstreamId}`, {
                state: { 
                    chapterId: chapterId,
                    workstreamId: workstreamId,
                    refresh: true
                }
            });
        } else if (workstreamId) {
            // If no specific chapter, navigate to workstream without chapter ID
            console.log('Navigating to workstream without specific chapter');
            navigate(`/employee/modules/${workstreamId}`);
        } else {
            // Fallback to modules list
            console.log('Fallback navigation to modules list');
            navigate('/employee/modules');
        }
    };

    const handleCloseResultsModal = async () => {
        console.log('handleCloseResultsModal called with:', {
            isFinalAssessment,
            passed: assessmentResults?.passed,
            chapterId,
            workstreamId
        });
        
        setShowResultsModal(false);
        
        // For final assessments that are passed, navigate back to workstreams list
        if (isFinalAssessment && assessmentResults?.passed) {
            console.log('Final assessment PASSED - navigating to modules list');
            navigate('/employee/modules');
        } else if (isFinalAssessment && !assessmentResults?.passed) {
            // For failed final assessments, navigate to the last regular chapter
            console.log('Final assessment FAILED - fetching chapters to find last regular chapter');
            try {
                const chaptersResponse = await axios.get(`${API_URL}/employee/workstreams/${workstreamId}/chapters`, {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });
                const chapters = chaptersResponse.data;
                
                // Sort chapters by order_index to ensure correct order
                const sortedChapters = [...chapters].sort((a, b) => {
                    if (a.order_index !== undefined && b.order_index !== undefined) {
                        return a.order_index - b.order_index;
                    }
                    return a.chapter_id - b.chapter_id;
                });
                
                console.log('All chapters sorted:', sortedChapters.map(ch => ({ id: ch.chapter_id, title: ch.title, order: ch.order_index })));
                
                // Find the last regular chapter (not a final assessment)
                const regularChapters = sortedChapters.filter(ch => {
                    const isFinal = ch.title.toLowerCase().includes('final assessment');
                    console.log(`Chapter "${ch.title}" - is final assessment:`, isFinal);
                    return !isFinal;
                });
                
                console.log('Regular chapters:', regularChapters.map(ch => ({ id: ch.chapter_id, title: ch.title })));
                const lastRegularChapter = regularChapters[regularChapters.length - 1];
                
                console.log('Failed final assessment - navigating to last regular chapter:', lastRegularChapter?.title, 'ID:', lastRegularChapter?.chapter_id);
                
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
            // Use immediate navigation without API calls to prevent 404 errors
            console.log('REGULAR assessment (not final) - navigating back to chapter');
            console.log('Regular assessment navigation - chapterId:', chapterId, 'workstreamId:', workstreamId, 'passed:', assessmentResults?.passed);
            if (workstreamId && chapterId) {
                navigate(`/employee/modules/${workstreamId}`, {
                    state: { 
                        refresh: true, 
                        chapterId: chapterId,
                        workstreamId: workstreamId,
                        assessmentPassed: assessmentResults?.passed
                    }
                });
            } else if (workstreamId) {
                navigate(`/employee/modules/${workstreamId}`);
            } else {
                navigate('/employee/modules');
            }
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
                    {deadline && (
                        <div className={`deadline-info ${isExpired ? 'expired' : ''}`}>
                            <span className="deadline-label">Deadline:</span>
                            <span className="deadline-date">
                                {deadline.toLocaleString()}
                            </span>
                            {isExpired && (
                                <span className="expired-badge">EXPIRED</span>
                            )}
                        </div>
                    )}
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
                            <button 
                                onClick={isFinalAssessment && assessmentResults.passed ? handleFinishAndGetCertificate : handleCloseResultsModal} 
                                className="continue-btn"
                            >
                                {isFinalAssessment && assessmentResults.passed 
                                    ? <><FaCertificate /> Finish and Get Certificate</> 
                                    : 'Continue to Chapter'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Certificate Modal */}
            {showCertificateModal && certificateData && (
                <div className="modal-overlay certificate-modal-overlay">
                    <div className="certificate-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="certificate-modal-header">
                            <h2><FaCertificate /> Congratulations!</h2>
                            <button 
                                className="modal-close-btn"
                                onClick={() => setShowCertificateModal(false)}
                            >
                                ×
                            </button>
                        </div>
                        
                        <div className="certificate-display">
                            <div className="certificate-border">
                                <div className="certificate-background">
                                    <div className="certificate-bg-pattern"></div>
                                </div>
                                <div className="certificate-logo-section">
                                    <div className="certificate-logo-placeholder">LOGO</div>
                                </div>
                                <div className="certificate-content">
                                    <div className="certificate-header">
                                        <h1>CERTIFICATE OF COMPLETION</h1>
                                        <div className="certificate-decoration"></div>
                                    </div>
                                    
                                    <div className="certificate-body">
                                        <p className="certificate-text">This is to certify that</p>
                                        <h2 className="certificate-name">{certificateData.userName}</h2>
                                        <p className="certificate-text">has successfully completed the learning workstream</p>
                                        <h3 className="certificate-workstream">{certificateData.workstreamTitle}</h3>
                                        <p className="certificate-date">
                                            Completed on {certificateData.completionDate.toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                    
                                    <div className="certificate-footer">
                                        <div className="certificate-logo">
                                            <strong>PROJECT ARKANGHEL</strong>
                                            <span>Learning Management System</span>
                                        </div>
                                        <div className="certificate-id">
                                            Certificate ID: {btoa(`${certificateData.userEmail}-${certificateData.workstreamTitle}-${certificateData.completionDate.getTime()}`).substring(0, 12).toUpperCase()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="certificate-modal-actions">
                            <button 
                                className="btn-download-certificate"
                                onClick={handleDownloadCertificate}
                            >
                                <FaCertificate /> Download PDF Certificate
                            </button>
                            <button 
                                className="btn-back-to-modules"
                                onClick={() => {
                                    setShowCertificateModal(false);
                                    navigate('/employee/modules');
                                }}
                            >
                                Back to Modules
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TakeAssessments;