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

    // Fetch all workstreams
    useEffect(() => {
        const fetchWorkstreams = async () => {
            setIsLoading(true);
            try {
                const response = await axios.get(`${API_URL}/workstreams`);
                setWorkstreams(response.data);
                setError('');
            } catch (err) {
                setError('Failed to fetch workstreams. Please try again later.');
                console.error(err);
            }
            setIsLoading(false);
        };
        fetchWorkstreams();
    }, []);

    // Fetch chapters for a selected workstream
    const fetchChapters = async (workstreamId) => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/workstreams/${workstreamId}/chapters`);
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

    const handleNextChapter = () => {
        const currentIndex = chapters.findIndex(c => c.chapter_id === selectedChapter.chapter_id);
        if (currentIndex < chapters.length - 1) {
            handleSelectChapter(chapters[currentIndex + 1]);
        }
    };

    const renderWorkstreamView = () => (
        <>
            <h1>Workstreams</h1>
            <div className="grid-container">
                {workstreams.map((ws) => (
                    <div key={ws.workstream_id} className="card" onClick={() => handleSelectWorkstream(ws)}>
                        {ws.image_type && <img src={`${API_URL}/workstreams/${ws.workstream_id}/image`} alt={ws.title} className="card-image"/>}
                        <div className="card-content">
                            <h3>{ws.title}</h3>
                            <p>{ws.description}</p>
                        </div>
                    </div>
                ))}
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