import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/admin/A_Modules.css';

const API_URL = 'http://localhost:8081';

// #region Modals
const WorkstreamModal = ({ isOpen, onClose, onSubmit, currentWorkstream }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState(null);

    useEffect(() => {
        if (currentWorkstream) {
            setTitle(currentWorkstream.title);
            setDescription(currentWorkstream.description);
        } else {
            setTitle('');
            setDescription('');
            setImage(null);
        }
    }, [currentWorkstream, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        if (image) formData.append('image', image);
        onSubmit(formData);
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <span className="close" onClick={onClose}>&times;</span>
                <h2>{currentWorkstream ? 'Edit Workstream' : 'Add Workstream'}</h2>
                <form onSubmit={handleSubmit}>
                    <label>Title: <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
                    <label>Description: <textarea value={description} onChange={(e) => setDescription(e.target.value)} required /></label>
                    <label>Image: <input type="file" onChange={(e) => setImage(e.target.files[0])} accept="image/*" /></label>
                    <button type="submit">{currentWorkstream ? 'Update' : 'Create'}</button>
                </form>
            </div>
        </div>
    );
};

const ChapterModal = ({ isOpen, onClose, onSubmit, currentChapter, workstreamId }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [orderIndex, setOrderIndex] = useState(0);
    const [pdfFile, setPdfFile] = useState(null);
    const [videoFile, setVideoFile] = useState(null);

    useEffect(() => {
        if (currentChapter) {
            setTitle(currentChapter.title);
            setContent(currentChapter.content);
            setOrderIndex(currentChapter.order_index);
        } else {
            setTitle('');
            setContent('');
            setOrderIndex(0);
            setPdfFile(null);
            setVideoFile(null);
        }
    }, [currentChapter, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('workstream_id', workstreamId);
        formData.append('title', title);
        formData.append('content', content);
        formData.append('order_index', orderIndex);
        if (pdfFile) formData.append('pdf_file', pdfFile);
        if (videoFile) formData.append('video_file', videoFile);
        onSubmit(formData);
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <span className="close" onClick={onClose}>&times;</span>
                <h2>{currentChapter ? 'Edit Chapter' : 'Add Chapter'}</h2>
                <form onSubmit={handleSubmit}>
                    <label>Title: <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
                    <label>Content: <textarea value={content} onChange={(e) => setContent(e.target.value)} required /></label>
                    <label>Order: <input type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} required /></label>
                    <label>PDF File: <input type="file" onChange={(e) => setPdfFile(e.target.files[0])} accept=".pdf" /></label>
                    <label>Video File: <input type="file" onChange={(e) => setVideoFile(e.target.files[0])} accept="video/*" /></label>
                    <button type="submit">{currentChapter ? 'Update' : 'Create'}</button>
                </form>
            </div>
        </div>
    );
};

const AssessmentModal = ({ isOpen, onClose, onSubmit, currentAssessment, chapterId }) => {
    const [title, setTitle] = useState('');
    const [totalPoints, setTotalPoints] = useState(100);

    useEffect(() => {
        if (currentAssessment) {
            setTitle(currentAssessment.title);
            setTotalPoints(currentAssessment.total_points);
        } else {
            setTitle('');
            setTotalPoints(100);
        }
    }, [currentAssessment, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ chapter_id: chapterId, title, total_points: totalPoints });
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <span className="close" onClick={onClose}>&times;</span>
                <h2>{currentAssessment ? 'Edit Assessment' : 'Add Assessment'}</h2>
                <form onSubmit={handleSubmit}>
                    <label>Title: <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
                    <label>Total Points: <input type="number" value={totalPoints} onChange={(e) => setTotalPoints(e.target.value)} required /></label>
                    <button type="submit">{currentAssessment ? 'Update' : 'Create'}</button>
                </form>
            </div>
        </div>
    );
};

const QuestionModal = ({ isOpen, onClose, onSubmit, currentQuestion }) => {
    const [questionText, setQuestionText] = useState('');
    const [questionType, setQuestionType] = useState('Multiple Choice');
    const [options, setOptions] = useState(['', '', '', '']);
    const [correctAnswer, setCorrectAnswer] = useState('');

    useEffect(() => {
        if (currentQuestion) {
            setQuestionText(currentQuestion.question_text);
            setQuestionType(currentQuestion.question_type);
            setCorrectAnswer(currentQuestion.correct_answer);
            if (currentQuestion.question_type === 'Multiple Choice' && currentQuestion.options) {
                setOptions(currentQuestion.options);
            }
        } else {
            setQuestionText('');
            setQuestionType('Multiple Choice');
            setOptions(['', '', '', '']);
            setCorrectAnswer('');
        }
    }, [currentQuestion, isOpen]);

    if (!isOpen) return null;

    const handleOptionChange = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const questionData = {
            question_text: questionText,
            question_type: questionType,
            correct_answer: correctAnswer,
            options: questionType === 'Multiple Choice' ? options : null,
        };
        onSubmit(questionData);
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h2>{currentQuestion ? 'Edit Question' : 'Add Question'}</h2>
                <form onSubmit={handleSubmit}>
                    <label>Question Text:</label>
                    <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} required />

                    <label>Question Type:</label>
                    <select value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
                        <option value="Multiple Choice">Multiple Choice</option>
                        <option value="True or False">True or False</option>
                        <option value="Identification">Identification</option>
                    </select>

                    {questionType === 'Multiple Choice' && (
                        <div>
                            <label>Options:</label>
                            {options.map((option, index) => (
                                <input
                                    key={index}
                                    type="text"
                                    value={option}
                                    onChange={(e) => handleOptionChange(index, e.target.value)}
                                    placeholder={`Option ${index + 1}`}
                                    required
                                />
                            ))}
                            <label>Correct Answer:</label>
                            <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} required>
                                <option value="" disabled>Select the correct answer</option>
                                {options.map((option, index) => (
                                    option && <option key={index} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {questionType === 'True or False' && (
                        <div>
                            <label>Correct Answer:</label>
                            <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} required>
                                <option value="">Select...</option>
                                <option value="True">True</option>
                                <option value="False">False</option>
                            </select>
                        </div>
                    )}

                    {questionType === 'Identification' && (
                        <div>
                            <label>Correct Answer:</label>
                            <input type="text" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} required />
                        </div>
                    )}

                    <div className="modal-actions">
                        <button type="submit" className="btn-primary">{currentQuestion ? 'Update' : 'Create'}</button>
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// #endregion

// Main Modules Component
const A_Modules = () => {
    const [view, setView] = useState('workstreams'); // workstreams, chapters, assessments, questions
    const [workstreams, setWorkstreams] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [questions, setQuestions] = useState([]);
    
    const [selectedWorkstream, setSelectedWorkstream] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [selectedAssessment, setSelectedAssessment] = useState(null);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // #region Modal States
    const [isWorkstreamModalOpen, setIsWorkstreamModalOpen] = useState(false);
    const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);
    const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
    const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);

    const [currentWorkstream, setCurrentWorkstream] = useState(null);
    const [currentChapter, setCurrentChapter] = useState(null);
    const [currentAssessment, setCurrentAssessment] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    // #endregion

    // #region API Calls
    const fetchWorkstreams = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/workstreams`);
            setWorkstreams(response.data);
        } catch (err) { setError('Failed to fetch workstreams.'); console.error(err); } 
        finally { setIsLoading(false); }
    };

    const fetchChapters = async (workstreamId) => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/workstreams/${workstreamId}/chapters`);
            setChapters(response.data);
        } catch (err) { setError('Failed to fetch chapters.'); console.error(err); }
        finally { setIsLoading(false); }
    };

    const fetchAssessments = async (chapterId) => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/chapters/${chapterId}/assessments`);
            setAssessments(response.data);
        } catch (err) { setError('Failed to fetch assessments.'); console.error(err); }
        finally { setIsLoading(false); }
    };

    const fetchQuestions = async (assessmentId) => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/assessments/${assessmentId}/questions`);
            setQuestions(response.data);
        } catch (err) { setError('Failed to fetch questions.'); console.error(err); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchWorkstreams(); }, []);
    // #endregion

    // #region Handlers
    const handleWorkstreamSubmit = async (formData) => {
        const url = currentWorkstream ? `${API_URL}/workstreams/${currentWorkstream.workstream_id}` : `${API_URL}/workstreams`;
        const method = currentWorkstream ? 'put' : 'post';
        try {
            await axios[method](url, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            fetchWorkstreams();
            setIsWorkstreamModalOpen(false);
        } catch (err) { setError('Failed to save workstream.'); console.error(err); }
    };

    const handleWorkstreamDelete = async (workstreamId) => {
        if (window.confirm('Delete this workstream and all its content?')) {
            try {
                await axios.delete(`${API_URL}/workstreams/${workstreamId}`);
                fetchWorkstreams();
                if (selectedWorkstream?.workstream_id === workstreamId) setView('workstreams');
            } catch (err) { setError('Failed to delete workstream.'); console.error(err); }
        }
    };

    const handleChapterSubmit = async (formData) => {
        const url = currentChapter ? `${API_URL}/chapters/${currentChapter.chapter_id}` : `${API_URL}/chapters`;
        const method = currentChapter ? 'put' : 'post';
        console.log(`Submitting chapter to URL: ${url} with method: ${method}`);
        try {
            await axios[method](url, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            fetchChapters(selectedWorkstream.workstream_id);
            setIsChapterModalOpen(false);
        } catch (err) { 
            setError('Failed to save chapter.'); 
            console.error('Error saving chapter:', err);
            if (err.response) {
                console.error('Error response data:', err.response.data);
                console.error('Error response status:', err.response.status);
            }
        }
    };

    const handleChapterDelete = async (chapterId) => {
        if (window.confirm('Delete this chapter?')) {
            try {
                await axios.delete(`${API_URL}/chapters/${chapterId}`);
                fetchChapters(selectedWorkstream.workstream_id);
            } catch (err) { setError('Failed to delete chapter.'); console.error(err); }
        }
    };

    const handleAssessmentSubmit = async (data) => {
        const url = currentAssessment ? `${API_URL}/assessments/${currentAssessment.assessment_id}` : `${API_URL}/assessments`;
        const method = currentAssessment ? 'put' : 'post';
        try {
            await axios[method](url, data);
            fetchAssessments(selectedChapter.chapter_id);
            setIsAssessmentModalOpen(false);
        } catch (err) { setError('Failed to save assessment.'); console.error(err); }
    };

    const handleAssessmentDelete = async (assessmentId) => {
        if (window.confirm('Delete this assessment and all its questions?')) {
            try {
                await axios.delete(`${API_URL}/assessments/${assessmentId}`);
                fetchAssessments(selectedChapter.chapter_id);
            } catch (err) { setError('Failed to delete assessment.'); console.error(err); }
        }
    };

    const handleQuestionSubmit = async (questionData) => {
        const url = currentQuestion ? `${API_URL}/questions/${currentQuestion.question_id}` : `${API_URL}/questions`;
        const method = currentQuestion ? 'put' : 'post';
        const payload = { ...questionData, assessment_id: selectedAssessment.assessment_id };

        try {
            await axios[method](url, payload);
            fetchQuestions(selectedAssessment.assessment_id);
            setIsQuestionModalOpen(false);
        } catch (err) {
            setError('Failed to save question.');
            console.error('Error saving question:', err.response ? err.response.data : err.message);
        }
    };

    const handleQuestionDelete = async (questionId) => {
        if (window.confirm('Delete this question?')) {
            try {
                await axios.delete(`${API_URL}/questions/${questionId}`);
                fetchQuestions(selectedAssessment.assessment_id);
            } catch (err) { setError('Failed to delete question.'); console.error(err); }
        }
    };
    // #endregion

    // #region View Renderers
    const renderWorkstreamView = () => (
        <div className="modules-boxed-wrapper">
            <div className="modules-boxed-header">
                <div className="modules-boxed-header-row">
                    <h1 className="modules-boxed-title">Workstream Management</h1>
                    <div className="modules-boxed-action">
                        <button onClick={() => { setCurrentWorkstream(null); setIsWorkstreamModalOpen(true); }} className="add-btn">+ Add New Workstream</button>
                    </div>
                </div>
                <hr className="modules-boxed-divider" />
            </div>
            <div className="modules-boxed-content">
                <div className="modules-boxed-grid">
                    {workstreams.length === 0 && (
                        <div className="modules-empty">No workstreams found.</div>
                    )}
                    {workstreams.map((ws) => {
                        // Robust image URL logic
                        let imgSrc = 'https://via.placeholder.com/320x120?text=No+Image';
                        if (ws.image_url) {
                            if (/^https?:\/\//i.test(ws.image_url)) {
                                imgSrc = ws.image_url;
                            } else {
                                // Remove leading slashes only
                                let cleanPath = ws.image_url.replace(/^\/+/, '');
                                // If the backend serves from /uploads, ensure the path starts with uploads/
                                if (!cleanPath.startsWith('uploads/')) {
                                    cleanPath = 'uploads/' + cleanPath;
                                }
                                imgSrc = `${API_URL}/${cleanPath}`;
                            }
                        }
                        return (
                            <div key={ws.workstream_id} className="module-card">
                                <div className="workstream-image-wrapper" style={{ minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                    <img
                                        src={imgSrc}
                                        alt={ws.title}
                                        className="workstream-image"
                                        style={{ display: 'block', maxWidth: '100%', maxHeight: 140, minHeight: 80, objectFit: 'cover', background: '#f1f5f9', borderRadius: 12 }}
                                        onError={e => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/320x120?text=No+Image'; }}
                                    />
                                </div>
                                <div className="module-card-content">
                                    <h3 className="module-title">{ws.title}</h3>
                                    <p className="module-desc">{ws.description}</p>
                                </div>
                                <div className="actions module-actions">
                                    <button onClick={() => { setCurrentWorkstream(ws); setIsWorkstreamModalOpen(true); }} className="edit-btn">Edit</button>
                                    <button onClick={() => handleWorkstreamDelete(ws.workstream_id)} className="delete-btn">Delete</button>
                                    <button onClick={() => { setSelectedWorkstream(ws); fetchChapters(ws.workstream_id); setView('chapters'); }} className="manage-btn">Manage Chapters</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const renderChapterView = () => (
        <div className="modules-boxed-wrapper">
            <div className="modules-boxed-header">
                <div className="modules-boxed-header-row">
                    <button onClick={() => setView('workstreams')} className="back-btn" style={{ marginRight: 18 }}>← Back to Workstreams</button>
                    <h1 className="modules-boxed-title" style={{ fontSize: '1.7rem' }}>{selectedWorkstream.title} - Chapters</h1>
                    <div className="modules-boxed-action">
                        <button onClick={() => { setCurrentChapter(null); setIsChapterModalOpen(true); }} className="add-btn">+ Add New Chapter</button>
                    </div>
                </div>
                <hr className="modules-boxed-divider" />
            </div>
            <div className="modules-boxed-content">
                <div className="modules-boxed-grid">
                    {chapters.length === 0 && (
                        <div className="modules-empty">No chapters found.</div>
                    )}
                    {chapters.map((ch) => (
                        <div key={ch.chapter_id} className="module-card" style={{ minHeight: 180, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <div className="module-card-content" style={{ textAlign: 'left', width: '100%' }}>
                                <h4 style={{ fontSize: '1.18rem', fontWeight: 700, margin: '0 0 0.5em 0', color: '#1a1a2e' }}>{ch.order_index}. {ch.title}</h4>
                                <p style={{ color: '#555', fontSize: '1.04rem', margin: 0 }}>{ch.content && ch.content.length > 80 ? ch.content.slice(0, 80) + '...' : ch.content}</p>
                            </div>
                            <div className="actions module-actions" style={{ justifyContent: 'flex-end', borderTop: 'none', paddingTop: 10 }}>
                                <button onClick={() => { setCurrentChapter(ch); setIsChapterModalOpen(true); }} className="edit-btn">Edit</button>
                                <button onClick={() => handleChapterDelete(ch.chapter_id)} className="delete-btn">Delete</button>
                                <button onClick={() => { setSelectedChapter(ch); fetchAssessments(ch.chapter_id); setView('assessments'); }} className="manage-btn">Manage Assessment</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderAssessmentView = () => (
        <>
            <button onClick={() => setView('chapters')} className="back-btn">← Back to Chapters</button>
            <h1>{selectedChapter.title} - Assessments</h1>
            <button onClick={() => { setCurrentAssessment(null); setIsAssessmentModalOpen(true); }} className="add-btn">Add New Assessment</button>
            <div className="grid-container">
                {assessments.map((asm) => (
                    <div key={asm.assessment_id} className="card">
                        <h4>{asm.title}</h4>
                        <p>Total Points: {asm.total_points}</p>
                        <div className="actions">
                            <button onClick={() => { setCurrentAssessment(asm); setIsAssessmentModalOpen(true); }}>Edit</button>
                            <button onClick={() => handleAssessmentDelete(asm.assessment_id)} className="delete-btn">Delete</button>
                            <button onClick={() => { setSelectedAssessment(asm); fetchQuestions(asm.assessment_id); setView('questions'); }} className="manage-btn">Manage Questions</button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );

    const renderQuestionView = () => (
        <>
            <button onClick={() => setView('assessments')} className="back-btn">← Back to Assessments</button>
            <h1>{selectedAssessment.title} - Questions</h1>
            <button onClick={() => { setCurrentQuestion(null); setIsQuestionModalOpen(true); }} className="add-btn">Add New Question</button>
            <div className="list-container">
                {questions.map((q) => (
                    <div key={q.question_id} className="list-item-card">
                        <p><strong>Q:</strong> {q.question_text}</p>
                        <p><strong>Type:</strong> {q.question_type}</p>
                        <p><strong>Answer:</strong> {q.correct_answer}</p>
                        <div className="actions">
                            <button onClick={() => { setCurrentQuestion(q); setIsQuestionModalOpen(true); }}>Edit</button>
                            <button onClick={() => handleQuestionDelete(q.question_id)} className="delete-btn">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
    // #endregion

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <AdminSidebar />
            <main className="page-container" style={{ flex: 1 }}>
                {isLoading && <p>Loading...</p>}
                {error && <p className="error-message">{error}</p>}

                {view === 'workstreams' && renderWorkstreamView()}
                {view === 'chapters' && selectedWorkstream && renderChapterView()}
                {view === 'assessments' && selectedChapter && renderAssessmentView()}
                {view === 'questions' && selectedAssessment && renderQuestionView()}

                <WorkstreamModal isOpen={isWorkstreamModalOpen} onClose={() => setIsWorkstreamModalOpen(false)} onSubmit={handleWorkstreamSubmit} currentWorkstream={currentWorkstream} />
                <ChapterModal isOpen={isChapterModalOpen} onClose={() => setIsChapterModalOpen(false)} onSubmit={handleChapterSubmit} currentChapter={currentChapter} workstreamId={selectedWorkstream?.workstream_id} />
                <AssessmentModal isOpen={isAssessmentModalOpen} onClose={() => setIsAssessmentModalOpen(false)} onSubmit={handleAssessmentSubmit} currentAssessment={currentAssessment} chapterId={selectedChapter?.chapter_id} />
                <QuestionModal isOpen={isQuestionModalOpen} onClose={() => setIsQuestionModalOpen(false)} onSubmit={handleQuestionSubmit} currentQuestion={currentQuestion} assessmentId={selectedAssessment?.assessment_id} />
            </main>
        </div>
    );
};

export default A_Modules;