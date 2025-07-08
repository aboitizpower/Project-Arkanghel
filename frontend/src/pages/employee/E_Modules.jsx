import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/E_Modules.css';

const API_URL = 'http://localhost:8081';

const E_Modules = () => {
    const [workstreams, setWorkstreams] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [assessments, setAssessments] = useState([]);

    const [selectedWorkstream, setSelectedWorkstream] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(null);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        const loggedInUserId = localStorage.getItem('userId');
        if (loggedInUserId) {
            setUserId(loggedInUserId);
        } else {
            setError("You must be logged in to view this page.");
        }
    }, []);

    // Function to fetch workstreams that can be called from anywhere
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

    // Initial fetch of workstreams
    useEffect(() => {
        fetchWorkstreams();
    }, [userId]);

    // Fetch chapters for a selected workstream
    const fetchChapters = async (workstreamId) => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/employee/workstreams/${workstreamId}/chapters`);
            setChapters(response.data);
            setError('');
        } catch (err) {
            setError(`Failed to fetch chapters for workstream ${workstreamId}.`);
            console.error(err);
        }
        setIsLoading(false);
    };

    // Fetch assessments for a selected chapter
    const fetchAssessments = async (chapterId) => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/chapters/${chapterId}/assessments`);
            setAssessments(response.data);
            setError('');
        } catch (err) {
            setError(`Failed to fetch assessments for chapter ${chapterId}.`);
            console.error(err);
        }
        setIsLoading(false);
    };

    const handleSelectWorkstream = (workstream) => {
        setSelectedWorkstream(workstream);
        setSelectedChapter(null); // Reset chapter selection
        setAssessments([]); // Clear assessments
        fetchChapters(workstream.workstream_id);
    };

    const handleSelectChapter = (chapter) => {
        setSelectedChapter(chapter);
        fetchAssessments(chapter.chapter_id);
    };
    
    const handleBackToWorkstreams = () => {
        setSelectedWorkstream(null);
        setSelectedChapter(null);
        setChapters([]);
        setAssessments([]);
    };

    const handleBackToChapters = () => {
        setSelectedChapter(null);
        setAssessments([]);
    }

    const handlePreviousChapter = () => {
        const currentIndex = chapters.findIndex(c => c.chapter_id === selectedChapter.chapter_id);
        if (currentIndex > 0) {
            handleSelectChapter(chapters[currentIndex - 1]);
        }
    };

    const handleNextChapter = async () => {
        if (selectedChapter) {
            // Mark current chapter as complete if it has no assessments
            if (!assessments || assessments.length === 0) {
                console.log(`Chapter '${selectedChapter.title}' has no assessments. Marking as complete.`);
                try {
                    await axios.post(`${API_URL}/user-progress`, {
                        userId: userId,
                        chapterId: selectedChapter.chapter_id
                    });
                    // Refetch workstreams to update progress bars
                    await fetchWorkstreams();
                } catch (err) {
                    console.error('Failed to mark chapter as complete:', err);
                }
            } else {
                console.log(`Chapter '${selectedChapter.title}' has ${assessments.length} assessment(s). Progress will only update after passing the assessment.`);
            }
        }
        
        const currentIndex = chapters.findIndex(c => c.chapter_id === selectedChapter.chapter_id);
        if (currentIndex < chapters.length - 1) {
            handleSelectChapter(chapters[currentIndex + 1]);
        }
    };

    const renderWorkstreamView = () => (
        <>
            <h1>Workstreams</h1>
            <div className="grid-container-ws">
                {workstreams.map((ws, index) => {
                    // Use progress from API, default to 0 if null/undefined
                    const progress = Math.round(ws.progress || 0); 
                    const isCompleted = progress === 100;
                    const hasContent = ws.chapters_count > 0;

                    let actionButton;
                    if (isCompleted) {
                        actionButton = <button className="action-btn completed">Completed</button>;
                    } else if (hasContent) {
                        actionButton = <button className="action-btn start-learning" onClick={() => handleSelectWorkstream(ws)}>Start Learning</button>;
                    } else {
                        actionButton = <button className="action-btn no-content" disabled>No Content Available</button>;
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
                                <div className="card-ws-progress">
                                     <span className="progress-label">Progress</span>
                                     <span className="progress-percentage">{progress}%</span>
                                </div>
                                <div className="progress-bar-container">
                                    <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                                </div>
                                <div className="card-ws-action">
                                    {actionButton}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );

    const renderChapterView = () => (
        <>
            <button onClick={handleBackToWorkstreams} className="back-btn">← Back to Workstreams</button>
            <h1>{selectedWorkstream.title}</h1>
            <p>{selectedWorkstream.description}</p>
            <hr />
            <h2>Chapters</h2>
            <div className="chapters-list">
                {chapters.map((ch) => (
                    <div key={ch.chapter_id} className="chapter-item" onClick={() => handleSelectChapter(ch)}>
                        <h4>{ch.title}</h4>
                    </div>
                ))}
            </div>
        </>
    );

    const renderChapterDetailView = () => {
        const currentIndex = chapters.findIndex(c => c.chapter_id === selectedChapter.chapter_id);
        const isFirstChapter = currentIndex === 0;
        const isLastChapter = currentIndex === chapters.length - 1;

        return (
            <>
                <div className="navigation-header">
                    <button onClick={handleBackToChapters} className="back-btn">← Back to Chapters</button>
                    <div className="chapter-nav-buttons">
                        <button onClick={handlePreviousChapter} disabled={isFirstChapter} className="nav-btn">Previous Chapter</button>
                        <button onClick={handleNextChapter} disabled={isLastChapter} className="nav-btn">Next Chapter</button>
                    </div>
                </div>
                <h2>{selectedChapter.title}</h2>
                <div className="chapter-content">
                    <p>{selectedChapter.content}</p>
                    <div className="file-display">
                        {selectedChapter.pdf_filename && (
                            <div className="pdf-container">
                                <iframe 
                                    src={`${API_URL}/chapters/${selectedChapter.chapter_id}/pdf`}
                                    title={selectedChapter.title}
                                    width="100%"
                                    height="600px"
                                    style={{ border: 'none' }}
                                />
                            </div>
                        )}
                        {selectedChapter.video_filename && (
                            <div className="video-container">
                                <video 
                                    src={`${API_URL}/chapters/${selectedChapter.chapter_id}/video`}
                                    controls 
                                    width="100%"
                                    title={selectedChapter.title}
                                >
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        )}
                    </div>
                </div>
                <hr />
                <h3>Assessments</h3>
                <div className="assessments-list">
                    {assessments.length > 0 ? (
                        assessments.map((asm) => (
                            <Link to={`/employee/assessment/${asm.assessment_id}`} key={asm.assessment_id} className="assessment-item-link">
                                <div className="assessment-item">
                                    <h3>{asm.title}</h3>
                                    <p>Total Points: {asm.total_points}</p>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <p>No assessments for this chapter.</p>
                    )}
                </div>
            </>
        );
    };


    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <EmployeeSidebar />
            <main className="page-container" style={{ flex: 1 }}>
                {isLoading && <p>Loading...</p>}
                {error && <p className="error-message">{error}</p>}
                
                {!selectedWorkstream && !isLoading && renderWorkstreamView()}
                {selectedWorkstream && !selectedChapter && !isLoading && renderChapterView()}
                {selectedChapter && !isLoading && renderChapterDetailView()}

            </main>
        </div>
    );
};

export default E_Modules;