import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_Modules.css';
import { FaBook, FaClipboardList, FaArrowLeft, FaFilePdf, FaVideo, FaLock, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import LoadingOverlay from '../../components/LoadingOverlay';

const API_URL = 'http://localhost:8081';

const E_Modules = () => {
    const [workstreams, setWorkstreams] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [selectedWorkstream, setSelectedWorkstream] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [assessmentForCurrentChapter, setAssessmentForCurrentChapter] = useState(null);
    const [isAssessmentPassed, setIsAssessmentPassed] = useState(false);
    const [assessmentAttempts, setAssessmentAttempts] = useState(0);
    const [currentContentView, setCurrentContentView] = useState('video'); // 'video' or 'pdf'
    const [completedChapters, setCompletedChapters] = useState(new Set());

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [userId, setUserId] = useState(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const workstreamsPerPage = 8;

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

    useEffect(() => {
        const { workstreamId, chapterId, refresh } = location.state || {};
        if (refresh && workstreamId && workstreams.length > 0) {
            const workstreamToSelect = workstreams.find(ws => ws.workstream_id === workstreamId);
            if (workstreamToSelect) {
                handleSelectWorkstream(workstreamToSelect, chapterId);
                // Clear the refresh state to prevent re-triggering
                navigate(location.pathname, { state: { ...location.state, refresh: false }, replace: true });
            }
        }
    }, [location.state, workstreams, navigate]);

    useEffect(() => {
        // This effect runs when chapters are populated and location state has a chapterId
        const { chapterId, refresh, scrollToChapter } = location.state || {};
        if (chapterId && refresh && chapters.length > 0) {
            const chapterToSelect = chapters.find(ch => ch.chapter_id === chapterId);
            if (chapterToSelect) {
                handleSelectChapter(chapterToSelect);
                // Clear the refresh state to prevent re-triggering
                navigate(location.pathname, { state: {}, replace: true });
            }
        }
    }, [chapters, location.state]);

    const fetchWorkstreams = async () => {
        if (!userId) return;
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/employee/workstreams?userId=${userId}`);
            setWorkstreams(response.data);
            setError('');
        } catch (err) {
            setError('Failed to fetch workstreams. Please try again later.');
            console.error(err);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchWorkstreams();
    }, [userId]);

    const fetchChapters = async (workstreamId) => {
        if (!userId) return;
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/employee/workstreams/${workstreamId}?userId=${userId}`);
            const fetchedChapters = response.data.chapters || [];
            setChapters(fetchedChapters);

            if (fetchedChapters.length > 0) {
                // Automatically select the first chapter if none is selected
                if (!selectedChapter) {
                    handleSelectChapter(fetchedChapters[0]);
                }
            }
            setError('');
        } catch (err) {
            setError('Failed to fetch chapters. Please try again later.');
            console.error(err);
        }
        setIsLoading(false);
    };

    const fetchUserProgress = async (workstreamId) => {
        if (!userId) return;
        try {
            // Corrected API endpoint
            const response = await axios.get(`${API_URL}/employee/workstreams/${workstreamId}/progress?userId=${userId}`);
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

    const handleSelectWorkstream = (workstream, targetChapterId = null) => {
        // Navigate to the specific module route instead of handling internally
        const state = targetChapterId ? { chapterId: targetChapterId } : {};
        navigate(`/employee/modules/${workstream.workstream_id}`, { state });
    };

    const _selectChapterForView = async (chapter) => {
        setSelectedChapter(chapter);
        
        if (chapter.video_filename) {
            setCurrentContentView('video');
        } else if (chapter.pdf_filename) {
            setCurrentContentView('pdf');
        }

        // Fetch assessment and user progress for it
        setIsLoading(true);
        try {
            const assessmentRes = await axios.get(`${API_URL}/chapters/${chapter.chapter_id}/assessments`);
            if (assessmentRes.data && assessmentRes.data.length > 0) {
                const assessment = assessmentRes.data[0];
                setAssessmentForCurrentChapter(assessment);

                // Check if user has passed this assessment
                try {
                    const passRes = await axios.get(`${API_URL}/user-assessment-progress/${userId}/${assessment.assessment_id}`);
                    setIsAssessmentPassed(passRes.data && passRes.data.is_passed);
                    setAssessmentAttempts(passRes.data ? passRes.data.attempts : 0);
                } catch (progressError) {
                    if (progressError.response && progressError.response.status === 404) {
                        setIsAssessmentPassed(false); // Not taken yet
                        setAssessmentAttempts(0);
                    } else {
                        throw progressError; // A real error
                    }
                }
            } else {
                // NO ASSESSMENT for this chapter
                setAssessmentForCurrentChapter(null);
                setIsAssessmentPassed(true); // Can always proceed if no assessment

                // Since there's no assessment, we can mark the chapter as complete right away.
                if (userId && chapter.chapter_id) {
                    await axios.post(`${API_URL}/user-progress`, {
                        userId: userId,
                        chapterId: chapter.chapter_id,
                    });
                    setCompletedChapters(prev => new Set(prev).add(chapter.chapter_id));
                }
            }
        } catch (err) {
            if (err.response && err.response.status === 404) {
                // This means no assessment was found, which is not an application error.
                setAssessmentForCurrentChapter(null);
                setIsAssessmentPassed(true);
            } else {
                setError('Failed to load chapter data.');
                console.error(err);
                setIsAssessmentPassed(false);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectChapter = async (chapter) => {
        // Prevent selecting locked chapters.
        const chapterIndex = chapters.findIndex(c => c.chapter_id === chapter.chapter_id);
        if (chapterIndex > 0 && !completedChapters.has(chapters[chapterIndex - 1].chapter_id)) {
            // If it's not the first chapter and the previous one isn't complete, do nothing.
            return;
        }

        if (chapter.title.toLowerCase().includes('final assessment')) {
            const allChaptersComplete = chapters
                .filter(c => !c.title.toLowerCase().includes('final assessment'))
                .every(c => completedChapters.has(c.chapter_id));

            if (!allChaptersComplete) {
                alert("You must complete all chapters before taking the final assessment.");
                return;
            }

            const fetchAndNavigate = async () => {
                setIsLoading(true);
                try {
                    const response = await axios.get(`${API_URL}/chapters/${chapter.chapter_id}/assessments`);
                    if (response.data && response.data.length > 0) {
                        navigate(`/employee/assessment/${response.data[0].assessment_id}`, {
                            state: {
                                workstreamId: selectedWorkstream.workstream_id,
                                chapterId: chapter.chapter_id
                            }
                        });
                    } else {
                        setError('Assessment not found.');
                    }
                } catch (err) {
                    setError('Could not load the assessment.');
                    console.error(err);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchAndNavigate();
        } else {
            _selectChapterForView(chapter);
        }
    };
    
    const handleBackToWorkstreams = () => {
        setSelectedWorkstream(null);
        setSelectedChapter(null);
        setChapters([]);
        setAssessmentForCurrentChapter(null);
        fetchWorkstreams(); // Refetch to show latest progress
    };

    const handleNextChapter = async () => {
        const isReadyForNext = !assessmentForCurrentChapter || isAssessmentPassed;

        if (selectedChapter && isReadyForNext) {
            try {
                // Mark current chapter as complete
                await axios.post(`${API_URL}/user-progress`, {
                    userId: userId,
                    chapterId: selectedChapter.chapter_id,
                });
                
                // Optimistically update the local state
                const updatedCompleted = new Set(completedChapters).add(selectedChapter.chapter_id);
                setCompletedChapters(updatedCompleted);
                
                // Check if this was the last regular chapter
                const regularChapters = chapters.filter(c => !c.title.toLowerCase().includes('final assessment'));
                const finalAssessmentChapter = chapters.find(c => c.title.toLowerCase().includes('final assessment'));
                const lastRegularChapterId = regularChapters.length > 0 ? regularChapters[regularChapters.length - 1].chapter_id : null;

                if (selectedChapter.chapter_id === lastRegularChapterId) {
                    if (finalAssessmentChapter) {
                        // Last chapter completed and there is a final assessment, navigate to it
                        handleSelectChapter(finalAssessmentChapter);
                    } else {
                        // Last chapter completed and no final assessment, mark workstream as complete
                        handleBackToWorkstreams();
                    }
                } else {
                    // Move to the next chapter in the sequence
                    const currentIndex = chapters.findIndex(c => c.chapter_id === selectedChapter.chapter_id);
                    if (currentIndex < chapters.length - 1) {
                        _selectChapterForView(chapters[currentIndex + 1]);
                    }
                }
            } catch (err) {
                setError('Failed to save your progress. Please try again.');
                console.error('Failed to mark chapter as complete:', err);
            }
        }
    };

    const handlePreviousChapter = () => {
        const currentIndex = chapters.findIndex(c => c.chapter_id === selectedChapter.chapter_id);
        if (currentIndex > 0) {
            handleSelectChapter(chapters[currentIndex - 1]);
        }
    };

    const handleTakeAssessment = () => {
        if (assessmentForCurrentChapter) {
            navigate(`/employee/assessment/${assessmentForCurrentChapter.assessment_id}`, {
                state: {
                    workstreamId: selectedWorkstream.workstream_id,
                    chapterId: selectedChapter.chapter_id
                }
            });
        }
    };

    const renderWorkstreamView = () => {
        const totalPages = Math.ceil(workstreams.length / workstreamsPerPage);
        const startIndex = (currentPage - 1) * workstreamsPerPage;
        const endIndex = startIndex + workstreamsPerPage;
        const currentWorkstreams = workstreams.slice(startIndex, endIndex);

        if (workstreams.length === 0) {
            return <p className="no-workstreams-message">No workstreams assigned to you. Please contact your administrator.</p>;
        }

        return (
            <div className="page-container">
                <div className="grid-container-ws">
                    {currentWorkstreams.map((ws) => {
                        const progress = ws.chapters_count > 0 ? Math.round(ws.progress || 0) : 0;
                        const isCompleted = progress === 100;
                        const hasContent = ws.chapters_count > 0;

                        let actionButton;
                        if (!hasContent) {
                            actionButton = <button className="action-btn no-content" disabled>No Content Available</button>;
                        } else if (isCompleted) {
                            actionButton = <button className="action-btn completed">Completed</button>;
                        } else if (ws.has_final_assessment && ws.all_regular_chapters_completed) {
                            actionButton = <button className="action-btn start-learning" onClick={() => handleSelectWorkstream(ws)}>Take Final Assessment</button>;
                        } else {
                            actionButton = <button className="action-btn start-learning" onClick={() => handleSelectWorkstream(ws)}>Start Learning</button>;
                        }

                        return (
                            <div key={ws.workstream_id} className="card-ws">
                                <div className="card-ws-image-container" onClick={() => hasContent && handleSelectWorkstream(ws)}>
                                    {ws.image_type ? 
                                        <img src={`${API_URL}/workstreams/${ws.workstream_id}/image`} alt={ws.title} className="card-ws-image"/> :
                                        <div className="card-ws-image-placeholder"></div>
                                    }
                                </div>
                                <div className="card-ws-content">
                                    <h3 className="card-ws-title" onClick={() => hasContent && handleSelectWorkstream(ws)}>{ws.title}</h3>
                                    <div className="card-ws-stats">
                                        <span>{ws.chapters_count || 0} Chapters</span>
                                        <span>•</span>
                                        <span>{ws.assessments_count || 0} Assessments</span>
                                    </div>
                                    {hasContent ? (
                                        <>
                                            <div className="card-ws-progress">
                                                <span className="progress-label">Progress</span>
                                                <span className="progress-percentage">{progress}%</span>
                                            </div>
                                            <div className="progress-bar-container">
                                                <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="no-content-container">
                                            <p>No content available</p>
                                        </div>
                                    )}
                                    <div className="card-ws-action">
                                        {actionButton}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="pagination-wrapper">
                        <div className="pagination-container">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="pagination-btn"
                            >
                                &laquo;
                            </button>
                            {[...Array(totalPages).keys()].map(number => (
                                <button
                                    key={number + 1}
                                    onClick={() => setCurrentPage(number + 1)}
                                    className={`pagination-btn ${currentPage === number + 1 ? 'active' : ''}`}
                                >
                                    {number + 1}
                                </button>
                            ))}
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="pagination-btn"
                            >
                                &raquo;
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderModuleView = () => {
        if (!selectedWorkstream || !selectedChapter) {
            return <div>Loading module...</div>; 
        }

        const isNextButtonDisabled = !!assessmentForCurrentChapter && !isAssessmentPassed;
        const currentIndex = chapters.findIndex(c => c.chapter_id === selectedChapter.chapter_id);
        const isLastChapter = currentIndex === chapters.length - 1;
        const isFirstChapter = currentIndex === 0;

        const hasVideo = selectedChapter.video_filename;
        const hasPdf = selectedChapter.pdf_filename;

        const regularChapters = chapters.filter(c => !c.title.toLowerCase().includes('final assessment'));
        const finalAssessmentChapter = chapters.find(c => c.title.toLowerCase().includes('final assessment'));
        const areAllChaptersComplete = regularChapters.every(c => completedChapters.has(c.chapter_id));

        return (
            <div className="module-view-container">
                <div className="module-view-sidebar">
                    <div className="module-view-header">
                        <button onClick={handleBackToWorkstreams} className="back-to-ws-btn">
                            <FaArrowLeft />
                            <span>Back to Workstreams</span>
                        </button>
                        <h2>{selectedWorkstream.title}</h2>
                    </div>
                    <div className="chapter-list-container">
                        <ul className="chapter-list">
                            {regularChapters.map((ch, index) => {
                                const isLocked = index > 0 && !completedChapters.has(regularChapters[index - 1].chapter_id);
                                return (
                                    <li 
                                        key={ch.chapter_id} 
                                        className={`chapter-list-item ${selectedChapter.chapter_id === ch.chapter_id ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
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
                                            className={`chapter-list-item ${isLocked ? 'locked' : ''}`}
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

                <div className="module-view-content">
                    <div className="chapter-media-container">
                         {hasVideo && currentContentView === 'video' ? (
                            <video 
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
                                Previous
                            </button>
                            {assessmentForCurrentChapter && (
                                <button onClick={handleTakeAssessment} className="btn-take-assessment">
                                    Take Assessment
                                </button>
                            )}
                            <button onClick={handleNextChapter} className="btn-next-chapter" disabled={isNextButtonDisabled || isLastChapter}>
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    };

    return (
        <div className="e-modules-page">
            {!selectedWorkstream && <EmployeeSidebar />}
            <main className={`modules-main-content ${selectedWorkstream ? 'module-view-active' : ''}`}>
                <LoadingOverlay loading={isLoading} />
                {error && <p className="error-message">{error}</p>}
                {!isLoading && !error && (
                    selectedWorkstream ? renderModuleView() : renderWorkstreamView()
                )}
            </main>
        </div>
    );
};

export default E_Modules;