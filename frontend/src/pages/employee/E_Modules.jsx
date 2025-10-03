import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_Modules.css';
import { FaBook, FaClipboardList, FaArrowLeft, FaFilePdf, FaVideo, FaLock, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import LoadingOverlay from '../../components/LoadingOverlay';
import { useAuth } from '../../auth/AuthProvider';

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

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const { user } = useAuth();

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const workstreamsPerPage = 8;

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!user) {
            setError("You must be logged in to view this page.");
            setIsLoading(false);
            return;
        }
        
        // Reset error when user is available
        setError('');
    }, [user]);

    useEffect(() => {
        const { workstreamId, chapterId, refresh } = location.state || {};
        if (refresh && workstreamId && user) {
            // Refresh workstreams data first to get updated progress
            const refreshAndNavigate = async () => {
                try {
                    const response = await axios.get(`${API_URL}/employee/workstreams`, {
                        headers: {
                            'Authorization': `Bearer ${user.token}`
                        }
                    });
                    setWorkstreams(response.data);
                    
                    const workstreamToSelect = response.data.find(ws => ws.workstream_id === parseInt(workstreamId));
                    if (workstreamToSelect) {
                        handleSelectWorkstream(workstreamToSelect, chapterId);
                    }
                    // Clear the refresh state to prevent re-triggering
                    navigate(location.pathname, { state: { ...location.state, refresh: false }, replace: true });
                } catch (err) {
                    console.error('Failed to refresh workstreams:', err);
                }
            };
            refreshAndNavigate();
        }
    }, [location.state, navigate, user]);

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

    const fetchWorkstreams = useCallback(async () => {
        if (!user || !user.token || !user.id) {
            setError('No user session found. Please log in again.');
            setIsLoading(false);
            return;
        }
        
        setIsLoading(true);
        
        try {
            // Create axios instance with default config
            const api = axios.create({
                baseURL: API_URL,
                withCredentials: true,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                xsrfCookieName: 'XSRF-TOKEN',
                xsrfHeaderName: 'X-XSRF-TOKEN'
            });
            
            // First make an OPTIONS request to handle preflight
            await api.options('/employee/workstreams');
            
            // Then make the actual GET request
            const response = await api.get('/employee/workstreams', {
                params: { userId: user.id },
                withCredentials: true
            });
            
            console.log('Workstreams API Response:', {
                status: response.status,
                statusText: response.statusText,
                data: response.data
            });
            
            if (!response.data) {
                throw new Error('Empty response from server');
            }
            
            if (Array.isArray(response.data) && response.data.length > 0) {
                // Show all workstreams, even those without content
                const allWorkstreams = response.data.filter(ws => ws.is_published !== false);
                
                if (allWorkstreams.length > 0) {
                    setWorkstreams(allWorkstreams);
                    setError('');
                } else {
                    setError('No published workstreams found.');
                    setWorkstreams([]);
                }
            } else {
                setError('No workstreams assigned to your account. Please contact your administrator.');
                setWorkstreams([]);
            }
            
        } catch (error) {
            console.error('Error fetching workstreams:', error);
            
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                if (error.response.status === 401) {
                    setError('Your session has expired. Please log in again.');
                } else if (error.response.status === 403) {
                    setError('You do not have permission to view workstreams.');
                } else if (error.response.status === 404) {
                    setError('Workstreams endpoint not found. Please contact support.');
                } else if (error.response.data && error.response.data.error) {
                    setError(`Server error: ${error.response.data.error}`);
                } else {
                    setError(`Server returned ${error.response.status}: ${error.response.statusText}`);
                }
            } else if (error.request) {
                // The request was made but no response was received
                console.error('No response received:', error.request);
                setError('No response from server. Please check your network connection and try again.');
            } else {
                // Something happened in setting up the request
                setError(`Error: ${error.message}`);
            }
            
            setWorkstreams([]);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchWorkstreams();
        }
    }, [user, fetchWorkstreams]);

    const fetchChapters = async (workstreamId) => {
        if (!user) return;
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/employee/workstreams/${workstreamId}`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            
            const fetchedChapters = response.data.chapters || [];
            setChapters(fetchedChapters);

            if (fetchedChapters.length > 0) {
                // Automatically select the first chapter if none is selected
                if (!selectedChapter) {
                    handleSelectChapter(fetchedChapters[0]);
                }
            } else {
                setError('No chapters available for this workstream.');
            }
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to fetch chapters. Please try again later.';
            setError(errorMessage);
            console.error('Error fetching chapters:', err);
        }
        setIsLoading(false);
    };

    const fetchUserProgress = async (workstreamId) => {
        if (!user) return;
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

    const handleSelectWorkstream = async (workstream) => {
        const hasContent = workstream.regular_chapters_count > 0 || workstream.assessments_count > 0;
        const isExpired = workstream.is_expired || false;
        
        if (!userId || !hasContent || isExpired) {
            if (isExpired) {
                alert('This workstream has expired and is no longer accessible.');
            }
            return;
        }

        setIsLoading(true);
        try {
            // Fetch the last-viewed chapter ID from the new endpoint
            const response = await axios.get(`${API_URL}/employee/workstreams/${workstream.workstream_id}/last-viewed-chapter?userId=${userId}`);
            const { chapterId } = response.data;

            // Navigate to the module view, passing the chapterId to start on
            navigate(`/employee/modules/${workstream.workstream_id}`, { 
                state: { chapterId: chapterId } 
            });

        } catch (err) {
            console.error('Error fetching last viewed chapter, navigating to default view.', err);
            // Fallback to navigating without a specific chapter if the endpoint fails
            navigate(`/employee/modules/${workstream.workstream_id}`);
        } finally {
            setIsLoading(false);
        }
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
                    await axios.post(`${API_URL}/employee/progress`, {
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
                        const hasContent = ws.regular_chapters_count > 0 || ws.assessments_count > 0;
                        const isExpired = ws.is_expired || false;
                        const deadline = ws.deadline ? new Date(ws.deadline) : null;

                        let actionButton;
                        if (isExpired) {
                            actionButton = <button className="action-btn expired" disabled>Expired</button>;
                        } else if (!hasContent) {
                            actionButton = <button className="action-btn no-content" disabled>No Content Available</button>;
                        } else if (isCompleted) {
                            actionButton = <button className="action-btn completed">Completed</button>;
                        } else if (ws.has_final_assessment && ws.all_regular_chapters_completed) {
                            actionButton = <button className="action-btn start-learning" onClick={() => handleSelectWorkstream(ws)}>Take Final Assessment</button>;
                        } else {
                            actionButton = <button className="action-btn start-learning" onClick={() => handleSelectWorkstream(ws)}>Start Learning</button>;
                        }

                        return (
                            <div 
                              key={ws.workstream_id} 
                              className={`card-ws ${!hasContent || isExpired ? 'inactive' : 'clickable'} ${isExpired ? 'expired' : ''}`}
                              onClick={() => hasContent && !isExpired && navigate(`/employee/modules/${ws.workstream_id}`)}
                          >
                                <div className="card-ws-image-container">
                                    {ws.image_type ? 
                                        <img src={`${API_URL}/workstreams/${ws.workstream_id}/image`} alt={ws.title} className="card-ws-image"/> :
                                        <div className="card-ws-image-placeholder"></div>
                                    }
                                </div>
                                <div className="card-ws-content">
                                    <h3 className="card-ws-title">{ws.title}</h3>
                                    <div className="card-ws-stats">
                                        <span>{ws.regular_chapters_count || 0} Chapters</span>
                                        <span>•</span>
                                        <span>{ws.assessments_count || 0} Assessments</span>
                                    </div>
                                    {deadline && (
                                        <div className={`card-ws-deadline ${isExpired ? 'expired' : ''}`}>
                                            <span className="deadline-label">Deadline:</span>
                                            <span className="deadline-date">
                                                {deadline.toLocaleDateString()} {deadline.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                            {isExpired && <span className="expired-badge">EXPIRED</span>}
                                        </div>
                                    )}
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
                <div className="e-modules-main-content">
                    {isLoading && <LoadingOverlay />}
                    {error && <p className="error-message">{error}</p>}


                    {selectedWorkstream ? renderModuleView() : renderWorkstreamView()}
                </div>
            </main>
        </div>
    );
};

export default E_Modules;