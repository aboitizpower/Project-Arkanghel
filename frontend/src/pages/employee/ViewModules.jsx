import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_Modules.css';
import { FaBook, FaClipboardList, FaArrowLeft, FaFilePdf, FaVideo, FaLock, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import LoadingOverlay from '../../components/LoadingOverlay';

const API_URL = 'http://localhost:8081';

const ViewModules = () => {
    const { moduleId } = useParams(); // Get module ID from URL
    const [workstreams, setWorkstreams] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [selectedWorkstream, setSelectedWorkstream] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [assessmentForCurrentChapter, setAssessmentForCurrentChapter] = useState(null);
    const [isAssessmentPassed, setIsAssessmentPassed] = useState(false);
    const [assessmentAttempts, setAssessmentAttempts] = useState(0);
    const [currentContentView, setCurrentContentView] = useState('video'); // 'video' or 'pdf'
    const [completedChapters, setCompletedChapters] = useState(new Set());
    const [hasHandledRefreshNavigation, setHasHandledRefreshNavigation] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [userId, setUserId] = useState(null);

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const loggedInUserId = localStorage.getItem('userId');
        if (loggedInUserId) {
            setUserId(loggedInUserId);
        } else {
            setError("You must be logged in to view this page.");
        }
    }, []);

    // Fetch specific workstream based on moduleId
    const fetchWorkstreamById = async (workstreamId) => {
        if (!userId) return;
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/employee/workstreams/${workstreamId}?userId=${userId}`);
            const workstream = response.data.workstream;
            setSelectedWorkstream(workstream);
            await fetchChapters(workstreamId);
            await fetchUserProgress(workstreamId);
            setError('');
        } catch (err) {
            setError('Failed to fetch workstream. Please try again later.');
            console.error(err);
        }
        setIsLoading(false);
    };

    const fetchChapters = async (workstreamId) => {
        try {
            const response = await axios.get(`${API_URL}/employee/workstreams/${workstreamId}/chapters`);
            setChapters(response.data);
            setError('');
        } catch (err) {
            setError('Failed to fetch chapters. Please try again later.');
            console.error(err);
        }
    };

    const fetchUserProgress = async (workstreamId) => {
        if (!userId) return;
        try {
            const response = await axios.get(`${API_URL}/user-progress/${userId}/${workstreamId}`);
            const progressData = response.data.chapters.reduce((acc, chapter) => {
                if (chapter.is_completed) {
                    acc.add(chapter.chapter_id);
                }
                return acc;
            }, new Set());
            setCompletedChapters(progressData);
        } catch (err) {
            console.error('Failed to fetch user progress:', err);
        }
    };

    const _selectChapterForView = async (chapter, preserveAssessmentStatus = false) => {
        if (!chapter) return;

        setSelectedChapter(chapter);
        
        // Set default content view based on what's available
        if (chapter.video_filename) {
            setCurrentContentView('video');
        } else if (chapter.pdf_filename) {
            setCurrentContentView('pdf');
        } else {
            setCurrentContentView('video'); // fallback
        }
        
        setAssessmentForCurrentChapter(null); // Reset assessment state
        
        if (!preserveAssessmentStatus) {
            setIsAssessmentPassed(false);
        }

        // Fetch assessment for this chapter
        try {
            const assessmentResponse = await axios.get(`${API_URL}/employee/chapters/${chapter.chapter_id}/assessment`);
            const assessmentData = assessmentResponse.data.assessment;

            if (assessmentData && assessmentData.assessment_id) {
                setAssessmentForCurrentChapter(assessmentData);
                
                // Check if user has passed this assessment by checking answers table
                try {
                    const passCheckResponse = await axios.get(`${API_URL}/employee/assessment/${assessmentData.assessment_id}/passed?userId=${userId}`);
                    setIsAssessmentPassed(passCheckResponse.data.passed || false);
                } catch (passErr) {
                    console.log('Assessment not taken yet or failed to check pass status');
                    setIsAssessmentPassed(false);
                }
            }
        } catch (err) {
            console.error('Error fetching assessment:', err);
        }
    };

    const handleSelectChapter = async (chapter, workstream = selectedWorkstream, preserveAssessmentStatus = false) => {
        if (!userId || !chapter) {
            setError("Cannot select chapter. User or chapter data is missing.");
            return;
        }

        try {
            await _selectChapterForView(chapter, preserveAssessmentStatus);

            // Mark chapter as viewed only if a workstream is selected
            if (workstream && workstream.workstream_id) {
                await axios.post(`${API_URL}/employee/progress`, {
                    userId: userId,
                    chapterId: chapter.chapter_id,
                });
                // Optimistically update completed chapters
                setCompletedChapters(prev => new Set(prev).add(chapter.chapter_id));
            } else {
                console.error("Cannot update progress: workstream not selected.");
            }

        } catch (err) {
            console.error('Error selecting chapter:', err);
            setError('Failed to load chapter. Please try again.');
        }
    };

    const handleBackToWorkstreams = () => {
        navigate('/employee/modules');
    };

    const handleNextChapter = () => {
        if (!selectedChapter || !chapters.length) return;
        
        const currentIndex = chapters.findIndex(ch => ch.chapter_id === selectedChapter.chapter_id);
        if (currentIndex < chapters.length - 1) {
            const nextChapter = chapters[currentIndex + 1];
            
            // Check if current chapter has assessment and if it's passed
            if (assessmentForCurrentChapter && !isAssessmentPassed) {
                alert('You must pass the assessment for this chapter before proceeding to the next one.');
                return;
            }
            
            // If next chapter is a final assessment, redirect to assessment directly
            if (nextChapter.title.toLowerCase().includes('final assessment')) {
                handleFinalAssessmentClick(nextChapter);
            } else {
                handleSelectChapter(nextChapter);
            }
        }
    };

    const handlePreviousChapter = () => {
        if (!selectedChapter || !chapters.length) return;
        
        const currentIndex = chapters.findIndex(ch => ch.chapter_id === selectedChapter.chapter_id);
        if (currentIndex > 0) {
            handleSelectChapter(chapters[currentIndex - 1]);
        }
    };

    const handleTakeAssessment = () => {
        if (assessmentForCurrentChapter) {
            navigate(`/employee/assessment/${assessmentForCurrentChapter.assessment_id}`, {
                state: { 
                    chapterId: selectedChapter.chapter_id,
                    workstreamId: selectedWorkstream.workstream_id
                }
            });
        }
    };

    const handleFinalAssessmentClick = async (chapter) => {
        try {
            // Fetch assessment for this final assessment chapter
            const assessmentResponse = await axios.get(`${API_URL}/employee/chapters/${chapter.chapter_id}/assessment`);
            const assessmentData = assessmentResponse.data.assessment;

            if (assessmentData && assessmentData.assessment_id) {
                // Navigate directly to the assessment
                navigate(`/employee/assessment/${assessmentData.assessment_id}`, {
                    state: { 
                        chapterId: chapter.chapter_id,
                        workstreamId: selectedWorkstream.workstream_id
                    }
                });
            } else {
                // Fallback to regular chapter selection if no assessment found
                handleSelectChapter(chapter);
            }
        } catch (err) {
            console.error('Error fetching final assessment:', err);
            // Fallback to regular chapter selection on error
            handleSelectChapter(chapter);
        }
    };

    // Load workstream on component mount
    useEffect(() => {
        if (moduleId && userId) {
            fetchWorkstreamById(parseInt(moduleId));
        }
    }, [moduleId, userId]);

    // This useEffect is the single source of truth for selecting a chapter.
    useEffect(() => {
        // Don't run if chapters haven't loaded yet.
        if (chapters.length === 0 || !selectedWorkstream) return;

        const { chapterId, refresh, assessmentPassed } = location.state || {};
        console.log('ViewModules useEffect - Navigation state:', { chapterId, refresh, assessmentPassed });
        console.log('Available chapters:', chapters.map(ch => ({ id: ch.chapter_id, title: ch.title })));

        // This block runs when returning from an assessment with refresh flag.
        if (refresh && chapterId) {
            console.log('ViewModules - Handling refresh navigation to chapterId:', chapterId, 'assessmentPassed:', assessmentPassed);
            setHasHandledRefreshNavigation(true);
            // Refresh user progress first
            fetchUserProgress(selectedWorkstream.workstream_id).then(() => {
                const chapterToSelect = chapters.find(ch => ch.chapter_id === parseInt(chapterId));
                console.log('ViewModules - Found chapter to select:', chapterToSelect?.title, 'ID:', chapterToSelect?.chapter_id);
                if (chapterToSelect) {
                    const preserveStatus = assessmentPassed === true;
                    if (preserveStatus) {
                        setIsAssessmentPassed(true);
                        setCompletedChapters(prev => new Set(prev).add(chapterToSelect.chapter_id));
                    }
                    handleSelectChapter(chapterToSelect, selectedWorkstream, preserveStatus);
                } else {
                    console.error('ViewModules - Chapter not found for ID:', chapterId);
                }
            });
            // IMPORTANT: Clear the state so this block doesn't run again.
            navigate(location.pathname, { state: {}, replace: true });
        
        // This block runs when navigating to a specific chapter (from workstream selection).
        } else if (chapterId && !selectedChapter) {
            const chapterToSelect = chapters.find(ch => ch.chapter_id === parseInt(chapterId));
            
            // If the specified chapter is a final assessment and workstream is complete, redirect to last regular chapter
            if (chapterToSelect && chapterToSelect.title.toLowerCase().includes('final assessment')) {
                // Check if workstream is complete by fetching fresh progress data
                axios.get(`${API_URL}/user-progress/${userId}/${selectedWorkstream.workstream_id}`)
                    .then(response => {
                        const progressData = response.data.chapters.reduce((acc, chapter) => {
                            if (chapter.is_completed) {
                                acc.add(chapter.chapter_id);
                            }
                            return acc;
                        }, new Set());
                        
                        const regularChapters = chapters.filter(ch => !ch.title.toLowerCase().includes('final assessment'));
                        const allRegularCompleted = regularChapters.every(ch => progressData.has(ch.chapter_id));
                        
                        if (allRegularCompleted && regularChapters.length > 0) {
                            // Workstream is complete, redirect to last regular chapter instead
                            const lastRegularChapter = regularChapters[regularChapters.length - 1];
                            console.log('Redirecting from final assessment to last regular chapter:', lastRegularChapter.title);
                            handleSelectChapter(lastRegularChapter, selectedWorkstream);
                        } else {
                            // Not complete, allow final assessment selection
                            handleSelectChapter(chapterToSelect, selectedWorkstream);
                        }
                    })
                    .catch(err => {
                        console.error('Error checking progress for final assessment redirect:', err);
                        // Fallback to original chapter selection
                        handleSelectChapter(chapterToSelect, selectedWorkstream);
                    });
            } else if (chapterToSelect) {
                handleSelectChapter(chapterToSelect, selectedWorkstream);
            } else {
                // Fallback to first chapter if specified chapter not found
                handleSelectChapter(chapters[0], selectedWorkstream);
            }
            // Clear the state so this block doesn't run again.
            navigate(location.pathname, { state: {}, replace: true });
        
        // This block runs ONLY on the initial load when no specific chapter is requested.
        } else if (!selectedChapter && !chapterId && !hasHandledRefreshNavigation) {
            // Wait for user progress to be fetched, then make chapter selection decision
            fetchUserProgress(selectedWorkstream.workstream_id).then(() => {
                // Re-check completed chapters after fetching progress
                const regularChapters = chapters.filter(ch => !ch.title.toLowerCase().includes('final assessment'));
                
                // Get the latest completed chapters from the API call
                const updatedCompletedResponse = axios.get(`${API_URL}/user-progress/${userId}/${selectedWorkstream.workstream_id}`)
                    .then(response => {
                        const progressData = response.data.chapters.reduce((acc, chapter) => {
                            if (chapter.is_completed) {
                                acc.add(chapter.chapter_id);
                            }
                            return acc;
                        }, new Set());
                        
                        const allRegularCompleted = regularChapters.every(ch => progressData.has(ch.chapter_id));
                        
                        console.log('Initial chapter selection debug:', {
                            regularChapters: regularChapters.map(ch => ({ id: ch.chapter_id, title: ch.title })),
                            completedChapters: Array.from(progressData),
                            allRegularCompleted,
                            totalChapters: chapters.length
                        });
                        
                        if (allRegularCompleted && regularChapters.length > 0) {
                            // If workstream is complete, navigate to the last regular chapter instead of first
                            const lastRegularChapter = regularChapters[regularChapters.length - 1];
                            console.log('Selecting last regular chapter:', lastRegularChapter.title);
                            handleSelectChapter(lastRegularChapter, selectedWorkstream);
                        } else {
                            // Default behavior: select first chapter
                            console.log('Selecting first chapter (default behavior)');
                            handleSelectChapter(chapters[0], selectedWorkstream);
                        }
                    })
                    .catch(err => {
                        console.error('Error fetching progress for chapter selection:', err);
                        // Fallback to first chapter on error
                        handleSelectChapter(chapters[0], selectedWorkstream);
                    });
            });
        }
    }, [chapters, selectedWorkstream, location.state, navigate]);

    const renderModuleView = () => {
        if (!selectedWorkstream || !selectedChapter) return null;

        const currentChapterIndex = chapters.findIndex(ch => ch.chapter_id === selectedChapter.chapter_id);
        const isFirstChapter = currentChapterIndex === 0;
        const isLastChapter = currentChapterIndex === chapters.length - 1;
        
        // A chapter is considered complete if it's in the completed set.
        const isCurrentChapterCompleted = completedChapters.has(selectedChapter.chapter_id);
        // The 'Next' button is disabled if the current chapter has an assessment that has not yet been passed.
        const isNextButtonDisabled = assessmentForCurrentChapter && !isCurrentChapterCompleted;

        // Check if chapter has video or PDF content
        const hasVideo = selectedChapter.video_filename;
        const hasPdf = selectedChapter.pdf_filename;

        return (
            <div className="module-view">
                <div className="module-view-sidebar">
                    <div className="module-view-header">
                        <button onClick={handleBackToWorkstreams} className="btn-back">
                            <FaArrowLeft /> Back to Modules
                        </button>
                        <h2>{selectedWorkstream.title}</h2>
                        <p className="workstream-description">{selectedWorkstream.description}</p>
                    </div>

                    {chapters.length > 0 && (
                        <div className="chapters-list">
                            <h3>Chapters</h3>
                            <ul>
                                {chapters
                                    .filter(chapter => !chapter.title.toLowerCase().includes('final assessment'))
                                    .map((chapter, index) => {
                                        const isCompleted = completedChapters.has(chapter.chapter_id);
                                        const isSelected = selectedChapter && selectedChapter.chapter_id === chapter.chapter_id;
                                        const isLocked = index > 0 && !completedChapters.has(chapters[chapters.findIndex(ch => ch.chapter_id === chapter.chapter_id) - 1]?.chapter_id);
                                        
                                        return (
                                            <li 
                                                key={chapter.chapter_id} 
                                                className={`chapter-item ${isSelected ? 'selected' : ''} ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''}`}
                                                onClick={() => !isLocked && handleSelectChapter(chapter)}
                                            >
                                                <div className="chapter-checkbox-container">
                                                    <div className={`chapter-checkbox ${isCompleted ? 'checked' : ''}`}>
                                                        {isCompleted && <span className="checkmark">✓</span>}
                                                    </div>
                                                    <div className="chapter-content">
                                                        <div className="chapter-title">
                                                            {chapter.title}
                                                        </div>
                                                        {isLocked && <FaLock className="lock-icon" />}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                            </ul>
                        </div>
                    )}

                    {chapters.filter(chapter => chapter.title.toLowerCase().includes('final assessment')).length > 0 && (
                        <div className="final-assessments-list">
                            <h3>Final Assessment</h3>
                            <ul>
                                {chapters
                                    .filter(chapter => chapter.title.toLowerCase().includes('final assessment'))
                                    .map((chapter) => {
                                        const isCompleted = completedChapters.has(chapter.chapter_id);
                                        const isSelected = selectedChapter && selectedChapter.chapter_id === chapter.chapter_id;
                                        const regularChapters = chapters.filter(ch => !ch.title.toLowerCase().includes('final assessment'));
                                        const allRegularCompleted = regularChapters.every(ch => completedChapters.has(ch.chapter_id));
                                        const isLocked = !allRegularCompleted;
                                        
                                        return (
                                            <li 
                                                key={chapter.chapter_id} 
                                                className={`chapter-item final-assessment ${isSelected ? 'selected' : ''} ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''}`}
                                                onClick={() => !isLocked && handleFinalAssessmentClick(chapter)}
                                            >
                                                <div className="chapter-checkbox-container">
                                                    <div className={`chapter-checkbox ${isCompleted ? 'checked' : ''}`}>
                                                        {isCompleted && <span className="checkmark">✓</span>}
                                                    </div>
                                                    <div className="chapter-content">
                                                        <div className="chapter-title">
                                                            {chapter.title}
                                                        </div>
                                                        {isLocked && <FaLock className="lock-icon" />}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="module-view-content">
                    <div className="chapter-media-container">
                         {hasVideo && currentContentView === 'video' ? (
                            <video 
                                key={selectedChapter.chapter_id} // Add key to force re-render
                                src={`${API_URL}/chapters/${selectedChapter.chapter_id}/video`}
                                controls 
                                autoPlay
                                muted
                                width="100%"
                                title={selectedChapter.title}
                            >
                                Your browser does not support the video tag.
                            </video>
                        ) : hasPdf && currentContentView === 'pdf' ? (
                            <iframe 
                                key={selectedChapter.chapter_id} // Add key to force re-render
                                src={`${API_URL}/chapters/${selectedChapter.chapter_id}/pdf`}
                                title={selectedChapter.title}
                                width="100%"
                                height="100%"
                                style={{ border: 'none' }}
                            />
                        ) : (
                            <div className="media-placeholder">
                                <p>No content available for this chapter.</p>
                            </div>
                        )}
                    </div>
                    <div className="chapter-details">
                        <h3>{selectedChapter.title}</h3>
                        <p className="chapter-description">{selectedChapter.content}</p>
                    </div>
                    <div className="chapter-footer">
                        <div className="chapter-pagination">
                            {hasVideo && hasPdf && currentContentView === 'video' && (
                                <button onClick={() => setCurrentContentView('pdf')} className="btn-view-content">
                                    <FaFilePdf /> View PDF
                                </button>
                            )}
                            {hasVideo && hasPdf && currentContentView === 'pdf' && (
                                <button onClick={() => setCurrentContentView('video')} className="btn-view-content">
                                    <FaVideo /> View Video
                                </button>
                            )}
                        </div>
                        <div className="chapter-actions">
                            <button onClick={handlePreviousChapter} className="btn-previous-chapter" disabled={isFirstChapter}>
                                <FaChevronLeft /> Previous
                            </button>
                            {assessmentForCurrentChapter && (
                                <button onClick={handleTakeAssessment} className="btn-take-assessment">
                                    <FaClipboardList /> Take Assessment
                                </button>
                            )}
                            <button onClick={handleNextChapter} className="btn-next-chapter" disabled={isNextButtonDisabled || isLastChapter}>
                                Next <FaChevronRight />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="e-modules-page">
            <main className="modules-main-content module-view-active">
                <LoadingOverlay loading={isLoading} />
                {error && <p className="error-message">{error}</p>}
                {!isLoading && !error && selectedWorkstream && renderModuleView()}
                {!isLoading && !error && !selectedWorkstream && (
                    <div className="error-message">
                        <p>Module not found or you don't have access to this module.</p>
                        <button onClick={handleBackToWorkstreams} className="btn-back">
                            <FaArrowLeft /> Back to Modules
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ViewModules;
