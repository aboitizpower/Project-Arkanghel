import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_Modules.css';
import { FaBook, FaClipboardList, FaArrowLeft, FaFilePdf, FaVideo, FaLock, FaChevronLeft, FaChevronRight, FaCertificate, FaTrophy, FaDownload } from 'react-icons/fa';
import LoadingOverlay from '../../components/LoadingOverlay';
import { useAuth } from '../../auth/AuthProvider';
import arkanghelLogo from '../../assets/arkanghel_logo.png';
import certBackground from '../../assets/certbg.png';

const API_URL = 'http://localhost:8081';

const ViewModules = () => {
    const { moduleId } = useParams(); // Get module ID from URL
    const { user, loading: authLoading } = useAuth();
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
    const [showAssessmentModal, setShowAssessmentModal] = useState(false);
    const [showAssessmentCompletedModal, setShowAssessmentCompletedModal] = useState(false);
    const [workstreamProgress, setWorkstreamProgress] = useState(0);
    const [showCertificateModal, setShowCertificateModal] = useState(false);
    const [certificateData, setCertificateData] = useState(null);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const navigate = useNavigate();
    const location = useLocation();

    // Disable body scrolling when component mounts, enable when unmounts
    useEffect(() => {
        document.body.classList.add('module-view-active');
        return () => {
            document.body.classList.remove('module-view-active');
        };
    }, []);

    // Handle authentication state and data fetching
    useEffect(() => {
        if (authLoading) return; // Still loading auth state
        
        if (!user) {
            // If user is not authenticated, redirect to login
            navigate('/login', { state: { from: location.pathname } });
            return;
        }

        // If we have a moduleId and user is authenticated, fetch data
        if (moduleId && user.id) {
            const fetchData = async () => {
                try {
                    setIsLoading(true);
                    setError('');
                    await fetchWorkstreamById(moduleId);
                } catch (err) {
                    console.error('Error loading module:', err);
                    setError('Failed to load module. Please try again.');
                } finally {
                    setIsLoading(false);
                }
            };

            fetchData();
        }
    }, [moduleId, user, authLoading, navigate, location]);

    // Fetch specific workstream based on moduleId
    const fetchWorkstreamById = async (workstreamId) => {
        if (!user?.id) {
            throw new Error('User not authenticated');
        }
        
        try {
            const response = await axios.get(`${API_URL}/employee/workstreams/${workstreamId}`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                },
                params: {
                    userId: user.id
                }
            });
            
            if (!response.data || !response.data.workstream) {
                throw new Error('Invalid workstream data received');
            }
            
            const workstream = response.data.workstream;
            setSelectedWorkstream(workstream);
            
            // Set progress from backend API (includes chapters + assessment scores)
            if (workstream.progress !== undefined) {
                setWorkstreamProgress(Math.round(workstream.progress));
            }
            
            // Fetch chapters and user progress in parallel
            const [chaptersData] = await Promise.all([
                fetchChapters(workstreamId),
                fetchUserProgress(workstreamId)
            ]);
            
            // If there are chapters, select the first one by default
            if (chaptersData?.length > 0 && !selectedChapter) {
                setSelectedChapter(chaptersData[0]);
            }
            
            return workstream;
        } catch (err) {
            console.error('Error in fetchWorkstreamById:', err);
            setError(err.response?.data?.message || 'Failed to load module. Please try again.');
            throw err; // Re-throw to be caught by the caller
        }
    };

    const fetchChapters = async (workstreamId) => {
        if (!user?.id) {
            throw new Error('User not authenticated');
        }

        try {
            const response = await axios.get(`${API_URL}/employee/workstreams/${workstreamId}/chapters`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            
            if (!Array.isArray(response.data)) {
                throw new Error('Invalid chapters data received');
            }
            
            const sortedChapters = [...response.data].sort((a, b) => {
                // Sort by order if available, otherwise by chapter_id
                if (a.order !== undefined && b.order !== undefined) {
                    return a.order - b.order;
                }
                return a.chapter_id - b.chapter_id;
            });
            
            setChapters(sortedChapters);
            return sortedChapters;
        } catch (err) {
            console.error('Error in fetchChapters:', err);
            setError('Failed to load chapters. Please try again later.');
            throw err; // Re-throw to be caught by the caller
        }
    };

    const fetchUserProgress = async (workstreamId) => {
        if (!user?.id) {
            throw new Error('User not authenticated');
        }
        
        try {
            const response = await axios.get(`${API_URL}/user-progress/${user.id}/${workstreamId}`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            
            if (!response.data || !Array.isArray(response.data.chapters)) {
                console.warn('Invalid user progress data format received');
                return new Set();
            }
            
            const progressData = response.data.chapters.reduce((acc, chapter) => {
                if (chapter.is_completed && chapter.chapter_id) {
                    acc.add(chapter.chapter_id);
                }
                return acc;
            }, new Set());
            
            setCompletedChapters(progressData);
            
            // Note: Progress is now set from the backend API in fetchWorkstreamById
            // This ensures it includes both chapter completion and assessment scores
            
            return progressData;
        } catch (err) {
            console.error('Error in fetchUserProgress:', err);
            // Don't show error to user for progress, just return empty set
            return new Set();
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
            console.log(`Fetching assessment for chapter ${chapter.chapter_id}: ${chapter.title}`);
            const assessmentResponse = await axios.get(`${API_URL}/employee/chapters/${chapter.chapter_id}/assessment`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            const assessmentData = assessmentResponse.data.assessment;
            console.log(`Assessment data for chapter ${chapter.chapter_id}:`, assessmentData);

            if (assessmentData && assessmentData.assessment_id) {
                setAssessmentForCurrentChapter(assessmentData);
                
                // Check if user has passed this assessment by checking answers table
                try {
                    const passCheckResponse = await axios.get(`${API_URL}/employee/assessment/${assessmentData.assessment_id}/passed`, {
                        params: { userId: user.id },
                        headers: { 'Authorization': `Bearer ${user.token}` }
                    });
                    setIsAssessmentPassed(passCheckResponse.data.passed || false);
                } catch (passErr) {
                    console.log('Assessment not taken yet or failed to check pass status');
                    setIsAssessmentPassed(false);
                }
            } else {
                // No assessment for this chapter, clear assessment state
                setAssessmentForCurrentChapter(null);
                setIsAssessmentPassed(false);
            }
        } catch (err) {
            console.error('Error fetching assessment:', err);
            // On error, clear assessment state
            setAssessmentForCurrentChapter(null);
            setIsAssessmentPassed(false);
        }
    };

    // Store last viewed chapter in localStorage
    const storeLastViewedChapter = (workstreamId, chapterId) => {
        const key = `lastViewedChapter_${user?.id}_${workstreamId}`;
        localStorage.setItem(key, chapterId.toString());
        console.log('Stored last viewed chapter:', { workstreamId, chapterId, key });
    };

    // Get last viewed chapter from localStorage
    const getLastViewedChapter = (workstreamId) => {
        const key = `lastViewedChapter_${user?.id}_${workstreamId}`;
        const chapterId = localStorage.getItem(key);
        return chapterId ? parseInt(chapterId) : null;
    };

    // Clear last viewed chapter (when workstream is completed)
    const clearLastViewedChapter = (workstreamId) => {
        const key = `lastViewedChapter_${user?.id}_${workstreamId}`;
        localStorage.removeItem(key);
    };

    const handleSelectChapter = async (chapter, workstream = selectedWorkstream, preserveAssessmentStatus = false) => {
        if (!user?.id || !chapter) {
            setError("Cannot select chapter. User or chapter data is missing.");
            return;
        }

        try {
            // Store this chapter as the last viewed for this workstream
            storeLastViewedChapter(workstream.workstream_id, chapter.chapter_id);
            await _selectChapterForView(chapter, preserveAssessmentStatus);

            // Mark chapter as viewed only if a workstream is selected
            if (workstream && workstream.workstream_id) {
                await axios.post(`${API_URL}/employee/progress`, {
                    userId: user.id,
                    chapterId: chapter.chapter_id,
                }, {
                    headers: {
                        'Authorization': `Bearer ${user.token}`
                    }
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

    const handleNextChapter = async () => {
        if (!selectedChapter || !chapters.length) return;
        
        const currentIndex = chapters.findIndex(ch => ch.chapter_id === selectedChapter.chapter_id);
        if (currentIndex < chapters.length - 1) {
            const nextChapter = chapters[currentIndex + 1];
            
            // Check if current chapter has assessment and if it's passed
            if (assessmentForCurrentChapter && !isAssessmentPassed) {
                setShowAssessmentModal(true);
                return;
            }
            
            // Mark current chapter as completed before moving to next
            try {
                await axios.post(`${API_URL}/employee/progress`, {
                    userId: user.id,
                    chapterId: selectedChapter.chapter_id,
                }, {
                    headers: {
                        'Authorization': `Bearer ${user.token}`
                    }
                });
                // Optimistically update completed chapters
                setCompletedChapters(prev => new Set(prev).add(selectedChapter.chapter_id));
            } catch (err) {
                console.error('Error marking chapter as completed:', err);
            }
            
            // If next chapter is a final assessment, redirect to assessment directly
            if (nextChapter.title.toLowerCase().includes('final assessment')) {
                handleFinalAssessmentClick(nextChapter);
            } else {
                handleSelectChapter(nextChapter);
            }
        }
    };

    const handlePreviousChapter = async () => {
        if (!selectedChapter || !chapters.length) return;
        
        const currentIndex = chapters.findIndex(ch => ch.chapter_id === selectedChapter.chapter_id);
        if (currentIndex > 0) {
            const prevChapter = chapters[currentIndex - 1];
            
            // Mark current chapter as completed before moving to previous
            try {
                await axios.post(`${API_URL}/employee/progress`, {
                    userId: user.id,
                    chapterId: selectedChapter.chapter_id,
                }, {
                    headers: {
                        'Authorization': `Bearer ${user.token}`
                    }
                });
                // Optimistically update completed chapters
                setCompletedChapters(prev => new Set(prev).add(selectedChapter.chapter_id));
            } catch (err) {
                console.error('Error marking chapter as completed:', err);
            }
            
            handleSelectChapter(prevChapter);
        }
    };

    const handleTakeAssessment = async () => {
        if (assessmentForCurrentChapter) {
            // Check if user has completed this assessment with perfect score
            try {
                const perfectScoreResponse = await axios.get(
                    `${API_URL}/employee/assessment/${assessmentForCurrentChapter.assessment_id}/perfect-score`,
                    {
                        params: { userId: user.id },
                        headers: { 'Authorization': `Bearer ${user.token}` }
                    }
                );
                
                if (perfectScoreResponse.data.completed_with_perfect_score) {
                    // Show completion dialog and prevent access
                    setShowAssessmentCompletedModal(true);
                    return;
                }
            } catch (err) {
                console.error('Error checking perfect score:', err);
            }
            
            // Navigate to assessment
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
            const assessmentResponse = await axios.get(`${API_URL}/employee/chapters/${chapter.chapter_id}/assessment`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const assessmentData = assessmentResponse.data.assessment;

            if (assessmentData && assessmentData.assessment_id) {
                // Check if user has completed this final assessment with perfect score
                try {
                    const perfectScoreResponse = await axios.get(`${API_URL}/employee/assessment/${assessmentData.assessment_id}/perfect-score?userId=${user.id}`, {
                        headers: { 'Authorization': `Bearer ${user.token}` }
                    });
                    
                    if (perfectScoreResponse.data.completed_with_perfect_score) {
                        // Show completion dialog and prevent access
                        setShowAssessmentCompletedModal(true);
                        return;
                    }
                } catch (perfectScoreErr) {
                    console.log('Assessment not completed with perfect score or error checking:', perfectScoreErr);
                }

                // Navigate directly to the assessment if not completed with perfect score
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

    const handleDownloadCertificate = async () => {
        try {
            const response = await axios.get(`${API_URL}/employee/certificates/${selectedWorkstream.workstream_id}`, {
                params: { userId: user.id },
                responseType: 'blob', // Important for PDF download
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });

            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            
            // Generate filename
            const filename = `Certificate_${selectedWorkstream.title.replace(/[^a-zA-Z0-9]/g, '_')}_${user.first_name}_${user.last_name}.pdf`;
            link.setAttribute('download', filename);
            
            // Append to html link element page
            document.body.appendChild(link);
            
            // Start download
            link.click();
            
            // Clean up and remove the link
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

    const handleFinishWorkstream = async () => {
        try {
            console.log('Starting workstream finish process...');
            console.log('User:', user);
            console.log('Selected workstream:', selectedWorkstream);
            console.log('Selected chapter:', selectedChapter);
            
            // Prepare certificate data immediately
            const certData = {
                userName: `${user.first_name} ${user.last_name}`,
                workstreamTitle: selectedWorkstream.title,
                completionDate: new Date(),
                userEmail: user.email,
                workstreamId: selectedWorkstream.workstream_id
            };
            
            console.log('Setting certificate data:', certData);
            setCertificateData(certData);
            setShowCertificateModal(true);
            console.log('Modal should be showing now');
            
            // Mark current chapter as completed in background
            try {
                await axios.post(`${API_URL}/employee/progress`, {
                    userId: user.id,
                    chapterId: selectedChapter.chapter_id
                });
                console.log('Chapter marked as completed');
                
                // Update completed chapters state
                setCompletedChapters(prev => new Set(prev).add(selectedChapter.chapter_id));
            } catch (progressError) {
                console.error('Error marking progress:', progressError);
            }

        } catch (error) {
            console.error('Error finishing workstream:', error);
            alert('Error completing workstream. Please try again.');
        }
    };

    const checkWorkstreamCompletion = async (workstreamId) => {
        try {
            const response = await axios.get(`${API_URL}/employee/certificates/${workstreamId}/status`, {
                params: { userId: user.id },
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error checking completion status:', error);
            return { canDownloadCertificate: false };
        }
    };

    // Load workstream on component mount
    useEffect(() => {
        if (moduleId && user?.id) {
            fetchWorkstreamById(parseInt(moduleId));
        }
    }, [moduleId, user?.id]);

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
                axios.get(`${API_URL}/user-progress/${user.id}/${selectedWorkstream.workstream_id}`, {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                })
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
                const updatedCompletedResponse = axios.get(`${API_URL}/user-progress/${user.id}/${selectedWorkstream.workstream_id}`, {
                    headers: {
                        'Authorization': `Bearer ${user.token}`
                    }
                })
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
                        
                        // First, check if there's a last viewed chapter stored
                        const lastViewedChapterId = getLastViewedChapter(selectedWorkstream.workstream_id);
                        const lastViewedChapter = lastViewedChapterId ? chapters.find(ch => ch.chapter_id === lastViewedChapterId) : null;
                        
                        console.log('Last viewed chapter check:', {
                            workstreamId: selectedWorkstream.workstream_id,
                            lastViewedChapterId,
                            lastViewedChapter: lastViewedChapter?.title
                        });
                        
                        if (lastViewedChapter) {
                            // Return to the last viewed chapter
                            console.log('Returning to last viewed chapter:', lastViewedChapter.title);
                            handleSelectChapter(lastViewedChapter, selectedWorkstream);
                        } else if (allRegularCompleted && regularChapters.length > 0) {
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

    // Debug modal state changes
    useEffect(() => {
        console.log('Modal state changed:', { showCertificateModal, certificateData });
    }, [showCertificateModal, certificateData]);

    const renderModuleView = () => {
        if (!selectedWorkstream || !selectedChapter) return null;

        const currentChapterIndex = chapters.findIndex(ch => ch.chapter_id === selectedChapter.chapter_id);
        const isFirstChapter = currentChapterIndex === 0;
        const isLastChapter = currentChapterIndex === chapters.length - 1;
        
        // A chapter is considered complete if it's in the completed set.
        const isCurrentChapterCompleted = completedChapters.has(selectedChapter.chapter_id);
        // The 'Next' button is disabled if the current chapter has an assessment that has not yet been passed.
        const isNextButtonDisabled = assessmentForCurrentChapter && !isAssessmentPassed && !isCurrentChapterCompleted;

        // Check if chapter has video or PDF content
        const hasVideo = selectedChapter.video_filename;
        const hasPdf = selectedChapter.pdf_filename;
        const hasAnyContent = hasVideo || hasPdf;

        return (
            <div className="module-view">
                <div className="module-view-sidebar">
                    <div className="module-view-header">
                        <button onClick={handleBackToWorkstreams} className="btn-back">
                            <FaArrowLeft /> Back to Modules
                        </button>
                        <h2>{selectedWorkstream.title}</h2>
                        <p className="workstream-description">{selectedWorkstream.description}</p>
                        
                        {/* Progress and Certificate Section */}
                        <div className="workstream-progress-section">
                            <div className="progress-info">
                                <span className="progress-label">Progress: {workstreamProgress}%</span>
                                <div className="progress-bar-container">
                                    <div className="progress-bar" style={{ width: `${workstreamProgress}%` }}></div>
                                </div>
                            </div>
                            {workstreamProgress === 100 && (
                                <button 
                                    className="certificate-download-btn"
                                    onClick={handleDownloadCertificate}
                                    title="Download Certificate of Completion"
                                >
                                    <FaCertificate /> Download Certificate
                                </button>
                            )}
                        </div>
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
                        ) : hasAnyContent ? (
                            <div className="media-placeholder">
                                <p>Content is loading or temporarily unavailable.</p>
                                <p>Expected content: {hasVideo ? 'Video' : ''}{hasVideo && hasPdf ? ' and ' : ''}{hasPdf ? 'PDF' : ''}</p>
                                <button 
                                    onClick={() => window.location.reload()} 
                                    className="btn-reload"
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#007bff',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        marginTop: '10px'
                                    }}
                                >
                                    Reload Page
                                </button>
                            </div>
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
                            {isLastChapter && workstreamProgress === 100 ? (
                                <button 
                                    onClick={handleFinishWorkstream} 
                                    className="btn-finish-workstream"
                                >
                                    <FaCertificate /> Finish & Get Certificate
                                </button>
                            ) : !isLastChapter ? (
                                <button onClick={handleNextChapter} className="btn-next-chapter" disabled={isNextButtonDisabled}>
                                    Next <FaChevronRight />
                                </button>
                            ) : null}
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
                
                {/* Assessment Required Modal */}
                {showAssessmentModal && (
                    <div className="modal-overlay" onClick={() => setShowAssessmentModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Assessment Required</h3>
                            </div>
                            <div className="modal-body">
                                <p>You must pass the assessment for this chapter before proceeding to the next one.</p>
                            </div>
                            <div className="modal-footer">
                                <button 
                                    className="btn-modal-close" 
                                    onClick={() => setShowAssessmentModal(false)}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Assessment Completed Modal */}
                {showAssessmentCompletedModal && (
                    <div className="modal-overlay" onClick={() => setShowAssessmentCompletedModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Assessment Completed</h3>
                            </div>
                            <div className="modal-body">
                                <p>You have already completed this assessment with a perfect score. Access is no longer available.</p>
                            </div>
                            <div className="modal-footer">
                                <button 
                                    className="btn-modal-close" 
                                    onClick={() => setShowAssessmentCompletedModal(false)}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Certificate Modal */}
                {showCertificateModal && certificateData && (
                    <div className="modal-overlay certificate-modal-overlay" onClick={() => setShowCertificateModal(false)}>
                        <div className="certificate-modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="certificate-modal-header">
                                <h2><FaTrophy /> Congratulations!</h2>
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
                                        <img src={certBackground} alt="" className="certificate-bg-pattern" />
                                    </div>
                                    <div className="certificate-logo-section">
                                        <img src={arkanghelLogo} alt="Arkanghel Logo" className="certificate-logo-img" />
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
                                    <FaDownload /> Download PDF Certificate
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
            </main>
        </div>
    );
};

export default ViewModules;
