import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/admin/A_Modules.css';
import { FaCog, FaTrash, FaPlus, FaPencilAlt, FaEye, FaEyeSlash } from 'react-icons/fa';
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { BsGripVertical } from 'react-icons/bs';

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
                    <button type="submit" className="btn-primary">{currentWorkstream ? 'Update' : 'Create'}</button>
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
                    <button type="submit" className="btn-primary">{currentChapter ? 'Update' : 'Create'}</button>
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
                    <button type="submit" className="btn-primary">{currentAssessment ? 'Update' : 'Create'}</button>
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
    const [workstreams, setWorkstreams] = useState([]);
    const [selectedWorkstream, setSelectedWorkstream] = useState(null);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // #region Modal States
    const [isWorkstreamModalOpen, setIsWorkstreamModalOpen] = useState(false);
    const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);
    const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
    const [editingChapter, setEditingChapter] = useState(null);
    const [isChapterTitleEditing, setIsChapterTitleEditing] = useState(false);
    const [editedChapterTitle, setEditedChapterTitle] = useState('');
    const [isChapterDescriptionEditing, setIsChapterDescriptionEditing] = useState(false);
    const [editedChapterDescription, setEditedChapterDescription] = useState('');
    const [isChapterVideoEditing, setIsChapterVideoEditing] = useState(false);
    const [editedChapterVideo, setEditedChapterVideo] = useState(null);
    const [isChapterPdfEditing, setIsChapterPdfEditing] = useState(false);
    const [editedChapterPdf, setEditedChapterPdf] = useState(null);
    const [editingAssessment, setEditingAssessment] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [isAssessmentTitleEditing, setIsAssessmentTitleEditing] = useState(false);
    const [editedAssessmentTitle, setEditedAssessmentTitle] = useState('');
    const [isAssessmentPointsEditing, setIsAssessmentPointsEditing] = useState(false);
    const [editedAssessmentPoints, setEditedAssessmentPoints] = useState(0);

    // State for the new Workstream Creation Page
    const [isCreatingWorkstream, setIsCreatingWorkstream] = useState(false);
    const [newWorkstreamTitle, setNewWorkstreamTitle] = useState('');
    const [newWorkstreamDescription, setNewWorkstreamDescription] = useState('');
    const [newWorkstreamImage, setNewWorkstreamImage] = useState(null);

    // State for the new Chapter Creation Page
    const [isCreatingChapter, setIsCreatingChapter] = useState(false);
    const [newChapterTitle, setNewChapterTitle] = useState('');
    const [newChapterDescription, setNewChapterDescription] = useState('');

    // State for new Assessment Creation Page
    const [isCreatingAssessment, setIsCreatingAssessment] = useState(false);
    const [newAssessmentTitle, setNewAssessmentTitle] = useState('');
    const [newAssessmentTotalPoints, setNewAssessmentTotalPoints] = useState(100);

    const [currentWorkstream, setCurrentWorkstream] = useState(null);
    const [currentChapter, setCurrentChapter] = useState(null);
    const [currentAssessment, setCurrentAssessment] = useState(null);

    const [isTitleEditing, setIsTitleEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');

    const [isDescriptionEditing, setIsDescriptionEditing] = useState(false);
    const [editedDescription, setEditedDescription] = useState('');

    const [isImageEditing, setIsImageEditing] = useState(false);
    const [editedImage, setEditedImage] = useState(null);
    // #endregion

    // #region Data Fetching
    const fetchWorkstreamsAndChapters = async () => {
        setIsLoading(true);
        try {
            const workstreamsResponse = await axios.get(`${API_URL}/workstreams`);
            const workstreamsData = workstreamsResponse.data;

            const workstreamsWithData = await Promise.all(workstreamsData.map(async (ws) => {
                const chaptersResponse = await axios.get(`${API_URL}/workstreams/${ws.workstream_id}/chapters`).catch(() => ({ data: [] }));
                const chapters = chaptersResponse.data;
                
                const chaptersWithAssessments = await Promise.all(chapters.map(async (ch) => {
                    const assessmentResponse = await axios.get(`${API_URL}/chapters/${ch.chapter_id}/assessments`).catch(() => ({ data: [] }));
                    const chapterWithMedia = { ...ch, assessments: assessmentResponse.data };
                    // Check for properties that indicate a file exists and construct URLs
                    if (ch.video_filename) {
                        chapterWithMedia.video_url = `/chapters/${ch.chapter_id}/video`;
                    }
                    if (ch.pdf_filename) {
                        chapterWithMedia.pdf_url = `/chapters/${ch.chapter_id}/pdf`;
                    }
                    return chapterWithMedia;
                }));
                
                const workstreamWithImageUrl = { ...ws };
                if (ws.image_type) { // Check for image_type instead of image
                    workstreamWithImageUrl.image_url = `/workstreams/${ws.workstream_id}/image`;
                }
                return { ...workstreamWithImageUrl, chapters: chaptersWithAssessments };
            }));

            setWorkstreams(workstreamsWithData);
            return workstreamsWithData; // Return the fetched data
        } catch (err) {
            setError('Failed to fetch initial data.');
            console.error(err);
            return []; // Return empty array on error
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkstreamsAndChapters();
    }, []);

    useEffect(() => {
        if (editingAssessment) {
            const fetchQuestions = async () => {
                setIsLoading(true);
                try {
                    const response = await axios.get(`${API_URL}/assessments/${editingAssessment.assessment_id}/questions`);
                    setQuestions(response.data);
                } catch (err) {
                    setError('Failed to fetch questions.');
                    console.error(err);
                    setQuestions([]);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchQuestions();
        }
    }, [editingAssessment]);
    // #endregion

    // #region Handlers
    const handleWorkstreamSubmit = async (formData) => {
        const url = currentWorkstream ? `${API_URL}/workstreams/${currentWorkstream.workstream_id}` : `${API_URL}/workstreams`;
        const method = currentWorkstream ? 'put' : 'post';
        try {
            await axios[method](url, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            fetchWorkstreamsAndChapters();
            setIsWorkstreamModalOpen(false);
        } catch (err) {
            setError('Failed to save workstream.');
            console.error(err);
        }
    };

    const handleChapterSubmit = async (formData) => {
        if (selectedWorkstream && !formData.has('workstream_id')) {
            formData.append('workstream_id', selectedWorkstream.workstream_id);
        }

        const url = currentChapter ? `${API_URL}/chapters/${currentChapter.chapter_id}` : `${API_URL}/chapters`;
        const method = currentChapter ? 'put' : 'post';
        try {
            await axios[method](url, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            fetchWorkstreamsAndChapters();
            setIsChapterModalOpen(false);
        } catch (err) {
            setError('Failed to save chapter.');
            console.error(err);
        }
    };

    const handleAssessmentSubmit = async (data) => {
        const payload = { ...data, chapter_id: currentChapter.chapter_id };
        const url = currentAssessment ? `${API_URL}/assessments/${currentAssessment.assessment_id}` : `${API_URL}/assessments`;
        const method = currentAssessment ? 'put' : 'post';
        try {
            await axios[method](url, payload);
            fetchWorkstreamsAndChapters();
            setIsAssessmentModalOpen(false);
        } catch (err) {
            setError('Failed to save assessment.');
            console.error(err);
        }
    };

    const handleOpenWorkstreamModal = () => {
        setCurrentWorkstream(null);
        setIsWorkstreamModalOpen(true);
    };

    // #region Inline Edit Handlers for Workstream Details
    const handleEditTitle = () => {
        setIsTitleEditing(true);
        setEditedTitle(selectedWorkstream.title);
    };

    const handleSaveTitle = async () => {
        try {
            await axios.put(`${API_URL}/workstreams/${selectedWorkstream.workstream_id}`, { ...selectedWorkstream, title: editedTitle });
            // Optimistically update the selectedWorkstream state
            setSelectedWorkstream(prev => ({ ...prev, title: editedTitle }));
            setIsTitleEditing(false);
        } catch (err) {
            setError('Failed to update title.');
            console.error(err);
        }
    };

    const handleCancelTitle = () => {
        setIsTitleEditing(false);
        setEditedTitle('');
    };

    const handleEditDescription = () => {
        setIsDescriptionEditing(true);
        setEditedDescription(selectedWorkstream.description);
    };

    const handleSaveDescription = async () => {
        try {
            await axios.put(`${API_URL}/workstreams/${selectedWorkstream.workstream_id}`, { ...selectedWorkstream, description: editedDescription });
            setSelectedWorkstream(prev => ({ ...prev, description: editedDescription }));
            setIsDescriptionEditing(false);
        } catch (err) {
            setError('Failed to update description.');
            console.error(err);
        }
    };

    const handleCancelDescription = () => {
        setIsDescriptionEditing(false);
        setEditedDescription('');
    };

    const handleEditImage = () => {
        setIsImageEditing(true);
        setEditedImage(null); // Clear previous image selection
    };

    const handleSaveImage = async () => {
        if (!editedImage) {
            setError('No image selected.');
            return;
        }
        const formData = new FormData();
        // Append all existing workstream data to formData to prevent clearing other fields
        for (const key in selectedWorkstream) {
            if (key !== 'image_url' && key !== 'chapters') { // Exclude image_url and chapters as they are not direct input fields for this form
                formData.append(key, selectedWorkstream[key]);
            }
        }
        formData.append('image', editedImage);
        try {
            await axios.put(`${API_URL}/workstreams/${selectedWorkstream.workstream_id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Fetch workstreams again to get the new image URL
            const updatedWorkstreams = await fetchWorkstreamsAndChapters();
            const updatedWorkstream = updatedWorkstreams.find(ws => ws.workstream_id === selectedWorkstream.workstream_id);
            if (updatedWorkstream) {
                setSelectedWorkstream(updatedWorkstream);
            }
            setIsImageEditing(false);
        } catch (err) {
            setError('Failed to update image.');
            console.error(err);
        }
    };

    const handleCancelImage = () => {
        setIsImageEditing(false);
        setEditedImage(null);
    };
    // #endregion

    const handleOpenChapterModal = (ch = null, ws) => {
        setSelectedWorkstream(ws);
        setCurrentChapter(ch);
        setIsChapterModalOpen(true);
    };

    const handleOpenAssessmentModal = (ass = null, ch) => {
        setCurrentChapter(ch);
        setCurrentAssessment(ass);
        setIsAssessmentModalOpen(true);
    };

    const handleDeleteWorkstream = async (workstreamId) => {
        if (window.confirm('Delete this workstream and all its content?')) {
            try {
                await axios.delete(`${API_URL}/workstreams/${workstreamId}`);
                fetchWorkstreamsAndChapters();
                if (selectedWorkstream?.workstream_id === workstreamId) {
                    setSelectedWorkstream(null);
                }
            } catch (err) {
                setError('Failed to delete workstream.');
                console.error(err);
            }
        }
    };

    const handleChapterDelete = async (chapterId) => {
        if (window.confirm('Delete this chapter?')) {
            try {
                await axios.delete(`${API_URL}/chapters/${chapterId}`);
                fetchWorkstreamsAndChapters();
            } catch (err) {
                setError('Failed to delete chapter.');
                console.error(err);
            }
        }
    };

    const handleSaveChapterPdf = async () => {
        if (!editingChapter || !editedChapterPdf) return;

        const formData = new FormData();
        formData.append('pdf_file', editedChapterPdf);

        try {
            await axios.put(`${API_URL}/chapters/${editingChapter.chapter_id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            
            setIsChapterPdfEditing(false);
            alert('PDF updated successfully!');
            
            // Refetch data to show the new PDF link
            const updatedWorkstreams = await fetchWorkstreamsAndChapters();
            const newSelectedWorkstream = updatedWorkstreams.find(ws => ws.workstream_id === selectedWorkstream.workstream_id);
            if (newSelectedWorkstream) {
                const newEditingChapter = newSelectedWorkstream.chapters.find(ch => ch.chapter_id === editingChapter.chapter_id);
                if (newEditingChapter) setEditingChapter(newEditingChapter);
                setSelectedWorkstream(newSelectedWorkstream);
            }

        } catch (err) {
            setError('Failed to update chapter PDF.');
            console.error(err);
        }
    };

    const handleSaveChapterVideo = async () => {
        if (!editingChapter || !editedChapterVideo) return;

        const formData = new FormData();
        formData.append('video_file', editedChapterVideo);

        try {
            await axios.put(`${API_URL}/chapters/${editingChapter.chapter_id}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            
            setIsChapterVideoEditing(false);
            alert('Video updated successfully!');
            
            // Refetch data to show the new video
            const updatedWorkstreams = await fetchWorkstreamsAndChapters();
            const newSelectedWorkstream = updatedWorkstreams.find(ws => ws.workstream_id === selectedWorkstream.workstream_id);
            if (newSelectedWorkstream) {
                const newEditingChapter = newSelectedWorkstream.chapters.find(ch => ch.chapter_id === editingChapter.chapter_id);
                if (newEditingChapter) setEditingChapter(newEditingChapter);
                setSelectedWorkstream(newSelectedWorkstream);
            }

        } catch (err) {
            setError('Failed to update chapter video.');
            console.error(err);
        }
    };

    const handleSaveChapterDescription = async () => {
        if (!editingChapter) return;

        try {
            const updatedChapter = { ...editingChapter, content: editedChapterDescription };
            await axios.put(`${API_URL}/chapters/${editingChapter.chapter_id}`, { content: editedChapterDescription });
            
            setEditingChapter(updatedChapter);
            setIsChapterDescriptionEditing(false);

            // Refresh the main workstream list in the background
            const updatedWorkstreams = await fetchWorkstreamsAndChapters();
            const newSelectedWorkstream = updatedWorkstreams.find(ws => ws.workstream_id === selectedWorkstream.workstream_id);
            if (newSelectedWorkstream) {
                setSelectedWorkstream(newSelectedWorkstream);
            }

        } catch (err) {
            setError('Failed to update chapter description.');
            console.error(err);
        }
    };

    const handleSaveChapterTitle = async () => {
        if (!editingChapter) return;

        try {
            const updatedChapter = { ...editingChapter, title: editedChapterTitle };
            await axios.put(`${API_URL}/chapters/${editingChapter.chapter_id}`, { title: editedChapterTitle });
            
            setEditingChapter(updatedChapter);
            setIsChapterTitleEditing(false);

            // Refresh the main workstream list in the background
            const updatedWorkstreams = await fetchWorkstreamsAndChapters();
            const newSelectedWorkstream = updatedWorkstreams.find(ws => ws.workstream_id === selectedWorkstream.workstream_id);
            if (newSelectedWorkstream) {
                setSelectedWorkstream(newSelectedWorkstream);
            }

        } catch (err) {
            setError('Failed to update chapter title.');
            console.error(err);
        }
    };

    const handleOpenQuestionModal = (q = null) => {
        setCurrentQuestion(q);
        setIsQuestionModalOpen(true);
    };

    const handleQuestionSubmit = async (questionData) => {
        const url = currentQuestion
            ? `${API_URL}/questions/${currentQuestion.question_id}`
            : `${API_URL}/assessments/${editingAssessment.assessment_id}/questions`;
        const method = currentQuestion ? 'put' : 'post';

        try {
            await axios[method](url, questionData);
            const response = await axios.get(`${API_URL}/assessments/${editingAssessment.assessment_id}/questions`);
            setQuestions(response.data);
            setIsQuestionModalOpen(false);
        } catch (err) {
            setError('Failed to save question.');
            console.error(err);
        }
    };

    const onDragEnd = async (result) => {
        const { source, destination } = result;
        if (!destination) {
            return; // Dropped outside the list
        }
        if (destination.droppableId === source.droppableId && destination.index === source.index) {
            return; // Dropped in the same place
        }

        // Create a flat list of all items that can be dragged.
        const currentItems = selectedWorkstream.chapters.flatMap(chapter => ([
            { ...chapter, type: 'chapter', id: `ch-${chapter.chapter_id}` },
            ...(chapter.assessments ? chapter.assessments.map(assessment => ({ ...assessment, type: 'assessment', id: `as-${assessment.assessment_id}` })) : [])
        ]));

        // Perform the reorder in the flat list.
        const reorderedItems = Array.from(currentItems);
        const [removed] = reorderedItems.splice(source.index, 1);
        reorderedItems.splice(destination.index, 0, removed);

        // Reconstruct the nested structure from the reordered flat list.
        const newChapters = [];
        let currentChapter = null;
        const orphanedAssessments = [];

        for (const item of reorderedItems) {
            const { id, type, ...restOfItem } = item;

            if (type === 'chapter') {
                const newChapter = { ...restOfItem, assessments: [] };
                newChapters.push(newChapter);
                currentChapter = newChapter;
            } else if (type === 'assessment') {
                if (currentChapter) {
                    currentChapter.assessments.push(restOfItem);
                } else {
                    // This assessment was dragged to a position before any chapter.
                    // We'll hold on to it and add it to the first chapter later.
                    orphanedAssessments.push(restOfItem);
                }
            }
        }

        // If any assessments were orphaned, add them to the top of the first chapter.
        if (orphanedAssessments.length > 0 && newChapters.length > 0) {
            newChapters[0].assessments.unshift(...orphanedAssessments);
        } else if (orphanedAssessments.length > 0 && newChapters.length === 0) {
            // This case should not happen if there's at least one chapter,
            // but as a safeguard, we prevent losing the assessments.
            // We can't add them anywhere, so we revert the change.
            console.error("Cannot reorder: an assessment was dragged, but no chapters exist.");
            // Revert by simply not updating state and returning.
            return;
        }

        // Create the new state for an optimistic update.
        const newSelectedWorkstream = { ...selectedWorkstream, chapters: newChapters };
        
        // Optimistically update the UI.
        setSelectedWorkstream(newSelectedWorkstream);

        // Persist the changes to the backend.
        try {
            await axios.post(`${API_URL}/workstreams/${selectedWorkstream.workstream_id}/reorder-chapters`, { chapters: newChapters });
        } catch (err) {
            setError('Failed to save new order. Reverting changes.');
            console.error(err);
            
            // On failure, revert the optimistic update by re-fetching the original state.
            const originalWorkstreams = await fetchWorkstreamsAndChapters();
            const originalWs = originalWorkstreams.find(ws => ws.workstream_id === selectedWorkstream.workstream_id);
            if (originalWs) {
                setSelectedWorkstream(originalWs);
            }
        }
    };

    const handleToggleWorkstreamPublish = async (workstream) => {
        const newStatus = !workstream.is_published;
        try {
            await axios.put(`${API_URL}/workstreams/${workstream.workstream_id}/publish`, { is_published: newStatus });
            const updatedWorkstreams = workstreams.map(ws => 
                ws.workstream_id === workstream.workstream_id ? { ...ws, is_published: newStatus } : ws
            );
            setWorkstreams(updatedWorkstreams);

            if (selectedWorkstream && selectedWorkstream.workstream_id === workstream.workstream_id) {
                setSelectedWorkstream({ ...selectedWorkstream, is_published: newStatus });
            }

            alert(`Workstream successfully ${newStatus ? 'published' : 'unpublished'}.`);
        } catch (err) {
            setError('Failed to update workstream status.');
            console.error(err);
        }
    };

    const handleToggleChapterPublish = async (chapter) => {
        const newStatus = !chapter.is_published;
        try {
            await axios.put(`${API_URL}/chapters/${chapter.chapter_id}/publish`, { is_published: newStatus });
            
            const updatedChapter = { ...editingChapter, is_published: newStatus };
            setEditingChapter(updatedChapter);

            const updatedChapters = selectedWorkstream.chapters.map(ch =>
                ch.chapter_id === chapter.chapter_id ? { ...ch, is_published: newStatus } : ch
            );
            setSelectedWorkstream(prev => ({ ...prev, chapters: updatedChapters }));

            alert(`Chapter successfully ${newStatus ? 'published' : 'unpublished'}.`);
        } catch (err) {
            setError('Failed to update chapter status.');
            console.error(err);
        }
    };

    const handleCreateAssessment = async (e) => {
        e.preventDefault();
        if (!newAssessmentTitle) {
            setError('Title is required.');
            return;
        }

        const payload = {
            title: newAssessmentTitle,
            total_points: newAssessmentTotalPoints,
            chapter_id: editingChapter.chapter_id,
        };

        setIsLoading(true);
        try {
            await axios.post(`${API_URL}/assessments`, payload);
            await fetchWorkstreamsAndChapters().then(updatedWorkstreams => {
                const updatedWs = updatedWorkstreams.find(ws => ws.workstream_id === selectedWorkstream.workstream_id);
                if (updatedWs) {
                    setSelectedWorkstream(updatedWs);
                    const updatedCh = updatedWs.chapters.find(ch => ch.chapter_id === editingChapter.chapter_id);
                    if (updatedCh) {
                        setEditingChapter(updatedCh);
                    }
                }
            });
            setIsCreatingAssessment(false);
            // Reset form
            setNewAssessmentTitle('');
            setNewAssessmentTotalPoints(100);
        } catch (err) {
            setError('Failed to create assessment.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateChapter = async (e) => {
        e.preventDefault();
        if (!newChapterTitle) {
            setError('Title is required.');
            return;
        }

        const payload = {
            title: newChapterTitle,
            content: newChapterDescription,
            workstream_id: selectedWorkstream.workstream_id,
        };

        setIsLoading(true);
        try {
            await axios.post(`${API_URL}/chapters`, payload);
            await fetchWorkstreamsAndChapters().then(updatedWorkstreams => {
                const updatedWs = updatedWorkstreams.find(ws => ws.workstream_id === selectedWorkstream.workstream_id);
                if (updatedWs) {
                    setSelectedWorkstream(updatedWs);
                }
            });
            setIsCreatingChapter(false);
            // Reset form
            setNewChapterTitle('');
            setNewChapterDescription('');
        } catch (err) {
            setError('Failed to create chapter.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateWorkstream = async (e) => {
        e.preventDefault();
        if (!newWorkstreamTitle) {
            setError('Title is required.');
            return;
        }
        const formData = new FormData();
        formData.append('title', newWorkstreamTitle);
        formData.append('description', newWorkstreamDescription);
        if (newWorkstreamImage) {
            formData.append('image', newWorkstreamImage);
        }

        setIsLoading(true);
        try {
            await axios.post(`${API_URL}/workstreams`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            await fetchWorkstreamsAndChapters();
            setIsCreatingWorkstream(false);
            // Reset form
            setNewWorkstreamTitle('');
            setNewWorkstreamDescription('');
            setNewWorkstreamImage(null);
        } catch (err) {
            setError('Failed to create workstream.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveAssessmentDetails = async () => {
        if (!editingAssessment) return;

        const payload = {
            title: editedAssessmentTitle,
            total_points: editedAssessmentPoints,
        };

        try {
            await axios.put(`${API_URL}/assessments/${editingAssessment.assessment_id}`, payload);
            
            setEditingAssessment(prev => ({ ...prev, ...payload }));
            setIsAssessmentTitleEditing(false);
            setIsAssessmentPointsEditing(false);

            // Refresh the main workstream list in the background
            fetchWorkstreamsAndChapters();

        } catch (err) {
            setError('Failed to update assessment details.');
            console.error(err);
        }
    };

    const handleQuestionDelete = async (questionId) => {
        if (window.confirm('Are you sure you want to delete this question?')) {
            try {
                await axios.delete(`${API_URL}/questions/${questionId}`);
                setQuestions(questions.filter(q => q.question_id !== questionId));
            } catch (err) {
                setError('Failed to delete question.');
                console.error(err);
            }
        }
    };

    const handleAssessmentDelete = async (assessmentId) => {
        if (window.confirm('Delete this assessment?')) {
            try {
                await axios.delete(`${API_URL}/assessments/${assessmentId}`);
                fetchWorkstreamsAndChapters();
            } catch (err) {
                setError('Failed to delete assessment.');
                console.error(err);
            }
        }
    };

    const handleSelectWorkstream = (ws) => {
        const fullWorkstreamData = workstreams.find(w => w.workstream_id === ws.workstream_id);
        setSelectedWorkstream(fullWorkstreamData);
    };

    const handleBackToOverview = () => {
        setSelectedWorkstream(null);
    };
    // #endregion

    // #endregion

    if (isLoading) return <div className="loading-message">Loading workstreams...</div>;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <div className="admin-modules-container">
            <AdminSidebar />
            <main className="admin-modules-main-content">
            {isCreatingWorkstream ? (
                <div className="workstream-create-page">
                    <div className="workstream-create-header">
                        <button className="back-button" onClick={() => setIsCreatingWorkstream(false)}>&larr; Back to Workstreams</button>
                    </div>
                    <h2>Create New Workstream</h2>
                    <p className="subtitle">Fill out the details below to add a new workstream.</p>
                    <form onSubmit={handleCreateWorkstream} className="workstream-create-form">
                        <div className="edit-card">
                            <label htmlFor="ws-title">Workstream Title</label>
                            <input
                                id="ws-title"
                                type="text"
                                value={newWorkstreamTitle}
                                onChange={(e) => setNewWorkstreamTitle(e.target.value)}
                                className="form-control"
                                placeholder="Enter a title"
                                required
                            />
                        </div>
                        <div className="edit-card">
                            <label htmlFor="ws-desc">Workstream Description</label>
                            <textarea
                                id="ws-desc"
                                value={newWorkstreamDescription}
                                onChange={(e) => setNewWorkstreamDescription(e.target.value)}
                                className="form-control"
                                rows="5"
                                placeholder="Enter a description"
                            />
                        </div>
                        <div className="edit-card">
                            <label htmlFor="ws-image">Workstream Image</label>
                            <input
                                id="ws-image"
                                type="file"
                                onChange={(e) => setNewWorkstreamImage(e.target.files[0])}
                                className="form-control"
                                accept="image/*"
                            />
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="btn-primary" disabled={isLoading}>
                                {isLoading ? 'Creating...' : 'Create Workstream'}
                            </button>
                            <button type="button" className="btn-secondary" onClick={() => setIsCreatingWorkstream(false)}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            ) : editingAssessment ? (
                <div className="assessment-edit-page">
                    <div className="assessment-edit-header">
                        <button className="back-button" onClick={() => setEditingAssessment(null)}>&larr; Back to module setup</button>
                    </div>
                    <h2>Assessment Editor</h2>
                    <p className="subtitle">Manage details and questions for: {editingAssessment.title}</p>
                    
                    <div className="assessment-edit-content">
                        <div className="assessment-details-left">
                            {/* Assessment details editing will go here */}
                            <div className="edit-card">
                                <div className="card-header">
                                    <h4>Assessment Details</h4>
                                    <button className="action-link-button" onClick={() => {
                                        setIsAssessmentTitleEditing(true);
                                        setIsAssessmentPointsEditing(true);
                                        setEditedAssessmentTitle(editingAssessment.title);
                                        setEditedAssessmentPoints(editingAssessment.total_points);
                                    }}>Edit Details</button>
                                </div>
                                {isAssessmentTitleEditing ? (
                                    <div className="editing-view">
                                        <label>Title:</label>
                                        <input 
                                            type="text" 
                                            defaultValue={editingAssessment.title}
                                            onChange={(e) => setEditedAssessmentTitle(e.target.value)}
                                            className="form-control" 
                                        />
                                        <label>Total Points:</label>
                                        <input 
                                            type="number" 
                                            defaultValue={editingAssessment.total_points}
                                            onChange={(e) => setEditedAssessmentPoints(e.target.value)}
                                            className="form-control" 
                                        />
                                        <div className="edit-actions">
                                            <button className="btn-primary" onClick={handleSaveAssessmentDetails}>Save</button>
                                            <button className="btn-secondary" onClick={() => {
                                                setIsAssessmentTitleEditing(false);
                                                setIsAssessmentPointsEditing(false);
                                            }}>Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="display-view">
                                        <p><strong>Title:</strong> {editingAssessment.title}</p>
                                        <p><strong>Total Points:</strong> {editingAssessment.total_points}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="assessment-questions-right">
                            <div className="questions-header">
                                <h3>Questions</h3>
                                <button className="btn-primary" onClick={() => handleOpenQuestionModal(null)}>+ Add Question</button>
                            </div>
                            <div className="questions-list">
                                {questions.length > 0 ? questions.map(q => (
                                    <div key={q.question_id} className="question-item">
                                        <p className="question-text">{q.question_text}</p>
                                        <div className="question-actions">
                                            <button className="btn-icon" onClick={() => handleOpenQuestionModal(q)}><FaPencilAlt /></button>
                                            <button className="btn-delete" onClick={() => handleQuestionDelete(q.question_id)}>Delete</button>
                                        </div>
                                    </div>
                                )) : (
                                    <p>No questions yet. Add one to get started.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : editingChapter ? (
                <div className="chapter-edit-page">
                    <div className="chapter-edit-header">
                        <button className="back-button" onClick={() => setEditingChapter(null)}>&larr; Back to module setup</button>
                        <div className="header-actions-right">
                            {editingChapter.is_published ? (
                                <button onClick={() => handleToggleChapterPublish(editingChapter)} className="unpublish-button">Unpublish</button>
                            ) : (
                                <button onClick={() => handleToggleChapterPublish(editingChapter)} className="publish-button">Publish</button>
                            )}
                        </div>
                    </div>
                    <h2>Module Chapter Creation</h2>


                    <div className="chapter-edit-content">
                        <div className="chapter-edit-left">
                            <h3>Customize your chapter</h3>
                            <div className="edit-card">
                                {isChapterTitleEditing ? (
                                    <div className="editing-view">
                                        <input 
                                            type="text" 
                                            defaultValue={editingChapter.title}
                                            onChange={(e) => setEditedChapterTitle(e.target.value)}
                                            className="form-control" 
                                        />
                                        <div className="edit-actions">
                                            <button className="btn-primary" onClick={handleSaveChapterTitle}>Save</button>
                                            <button className="btn-secondary" onClick={() => setIsChapterTitleEditing(false)}>Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="display-view">
                                        <div className="card-header">
                                            <h4>Chapter Title</h4>
                                            <button className="action-link-button" onClick={() => {
                                                setIsChapterTitleEditing(true);
                                                setEditedChapterTitle(editingChapter.title);
                                            }}>Edit title</button>
                                        </div>
                                        <p>{editingChapter.title}</p>
                                    </div>
                                )}
                            </div>
                            <div className="edit-card description-card">
                                {isChapterDescriptionEditing ? (
                                    <div className="editing-view">
                                        <textarea 
                                            defaultValue={editingChapter.content}
                                            onChange={(e) => setEditedChapterDescription(e.target.value)}
                                            className="form-control description-editor" 
                                            rows="4"
                                        />
                                        <div className="edit-actions">
                                            <button className="btn-primary" onClick={handleSaveChapterDescription}>Save</button>
                                            <button className="btn-secondary" onClick={() => setIsChapterDescriptionEditing(false)}>Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="display-view">
                                        <div className="card-header">
                                            <h4>Chapter Description</h4>
                                            <button className="action-link-button" onClick={() => {
                                                setIsChapterDescriptionEditing(true);
                                                setEditedChapterDescription(editingChapter.content);
                                            }}>Edit description</button>
                                        </div>
                                                                                <p className="description-display">Objectives: {editingChapter.content || 'Not set'}</p>
                                    </div>
                                )}
                            </div>

                        </div>
                        <div className="chapter-edit-right">
                            <div className="edit-card">
                                {isChapterVideoEditing ? (
                                    <div className="editing-view">
                                        <p>Upload a new video file. This will replace the current video.</p>
                                        <input type="file" onChange={(e) => setEditedChapterVideo(e.target.files[0])} accept="video/*" className="form-control" />
                                        <div className="edit-actions">
                                            <button className="btn-primary" onClick={handleSaveChapterVideo}>Save Video</button>
                                            <button className="btn-secondary" onClick={() => setIsChapterVideoEditing(false)}>Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="display-view">
                                        <div className="card-header">
                                            <h4>Chapter Video</h4>
                                            <button className="action-link-button" onClick={() => setIsChapterVideoEditing(true)}>
                                                {editingChapter.video_url ? 'Replace Video' : 'Upload Video'}
                                            </button>
                                        </div>
                                        {editingChapter.video_url ? (
                                            <video src={`${API_URL}${editingChapter.video_url}?t=${new Date().getTime()}`} controls width="100%" key={editingChapter.video_url}>
                                                Your browser does not support the video tag.
                                            </video>
                                        ) : (
                                            <div className="placeholder-media">
                                                <p>No video uploaded.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="edit-card">
                                {isChapterPdfEditing ? (
                                    <div className="editing-view">
                                        <p>Upload a new PDF file. This will replace the current PDF.</p>
                                        <input type="file" onChange={(e) => setEditedChapterPdf(e.target.files[0])} accept=".pdf" className="form-control" />
                                        <div className="edit-actions">
                                            <button className="btn-primary" onClick={handleSaveChapterPdf}>Save PDF</button>
                                            <button className="btn-secondary" onClick={() => setIsChapterPdfEditing(false)}>Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="display-view">
                                        <div className="card-header">
                                            <h4>Chapter PDF</h4>
                                            <button className="action-link-button" onClick={() => setIsChapterPdfEditing(true)}>
                                                {editingChapter.pdf_url ? 'Replace PDF' : 'Upload PDF'}
                                            </button>
                                        </div>
                                        {editingChapter.pdf_url ? (
                                            <div className="placeholder-media">
                                                <a href={`${API_URL}${editingChapter.pdf_url}?t=${new Date().getTime()}`} target="_blank" rel="noopener noreferrer" className="action-link-button">
                                                    {editingChapter.pdf_filename || 'View Uploaded PDF'}
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="placeholder-media">
                                                <p>No PDF uploaded.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="edit-card">
                                <div className="card-header">
                                    <h4>Assessments</h4>
                                    <button className="btn-primary" onClick={() => setIsCreatingWorkstream(true)}>New Workstream</button>
                                </div>
                                <div className="assessments-list-mini">
                                    {editingChapter.assessments && editingChapter.assessments.length > 0 ? (
                                        editingChapter.assessments.map(assessment => (
                                            <div key={assessment.assessment_id} className="list-item assessment-item-mini">
                                                <span>{assessment.title}</span>
                                                <button className="edit-item-button" onClick={() => setEditingAssessment(assessment)}><FaPencilAlt /></button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="no-content-message">No assessments for this chapter.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : isCreatingAssessment ? (
                <div className="assessment-create-page">
                    <div className="assessment-create-header">
                        <button className="back-button" onClick={() => setIsCreatingAssessment(false)}>&larr; Back to Chapter Edit</button>
                    </div>
                    <h2>Create New Assessment</h2>
                    <p className="subtitle">For chapter: {editingChapter.title}</p>
                    <form onSubmit={handleCreateAssessment} className="assessment-create-form">
                        <div className="edit-card">
                            <label htmlFor="as-title">Assessment Title</label>
                            <input
                                id="as-title"
                                type="text"
                                value={newAssessmentTitle}
                                onChange={(e) => setNewAssessmentTitle(e.target.value)}
                                className="form-control"
                                placeholder="Enter a title"
                                required
                            />
                        </div>
                        <div className="edit-card">
                            <label htmlFor="as-points">Total Points</label>
                            <input
                                id="as-points"
                                type="number"
                                value={newAssessmentTotalPoints}
                                onChange={(e) => setNewAssessmentTotalPoints(parseInt(e.target.value, 10))}
                                className="form-control"
                            />
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="btn-primary" disabled={isLoading}>
                                {isLoading ? 'Creating...' : 'Create Assessment'}
                            </button>
                            <button type="button" className="btn-secondary" onClick={() => setIsCreatingAssessment(false)}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            ) : isCreatingChapter ? (
                <div className="chapter-create-page">
                    <div className="chapter-create-header">
                        <button className="back-button" onClick={() => setIsCreatingChapter(false)}>&larr; Back to Module Setup</button>
                    </div>
                    <h2>Create New Chapter</h2>
                    <p className="subtitle">For workstream: {selectedWorkstream.title}</p>
                    <form onSubmit={handleCreateChapter} className="chapter-create-form">
                        <div className="edit-card">
                            <label htmlFor="ch-title">Chapter Title</label>
                            <input
                                id="ch-title"
                                type="text"
                                value={newChapterTitle}
                                onChange={(e) => setNewChapterTitle(e.target.value)}
                                className="form-control"
                                placeholder="Enter a title"
                                required
                            />
                        </div>
                        <div className="edit-card">
                            <label htmlFor="ch-desc">Chapter Description</label>
                            <textarea
                                id="ch-desc"
                                value={newChapterDescription}
                                onChange={(e) => setNewChapterDescription(e.target.value)}
                                className="form-control"
                                rows="5"
                                placeholder="Enter a description"
                            />
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="btn-primary" disabled={isLoading}>
                                {isLoading ? 'Creating...' : 'Create Chapter'}
                            </button>
                            <button type="button" className="btn-secondary" onClick={() => setIsCreatingChapter(false)}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            ) : selectedWorkstream ? (
                <DragDropContext onDragEnd={onDragEnd}>
                                        <div className="module-setup-header">
                        <button className="back-button" onClick={() => setSelectedWorkstream(null)}>&larr; Back to all workstreams</button>
                    </div>
                    <div className="admin-module-setup-grid">
                        {/* Left Column: Workstream Details */} 
                        <div className="admin-module-info-section">
                            <h3>Module Title
                                {!isTitleEditing ? (
                                    <button className="edit-button" onClick={handleEditTitle}>Edit Title</button>
                                ) : (
                                    <>
                                        <button className="edit-button" onClick={handleSaveTitle}>Save</button>
                                        <button className="edit-button" onClick={handleCancelTitle}>Cancel</button>
                                    </>
                                )}
                            </h3>
                            {!isTitleEditing ? (
                                <p>{selectedWorkstream.title}</p>
                            ) : (
                                <input type="text" value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} />
                            )}

                            <h3>Module Description
                                {!isDescriptionEditing ? (
                                    <button className="edit-button" onClick={handleEditDescription}>Edit Description</button>
                                ) : (
                                    <>
                                        <button className="edit-button" onClick={handleSaveDescription}>Save</button>
                                        <button className="edit-button" onClick={handleCancelDescription}>Cancel</button>
                                    </>
                                )}
                            </h3>
                            {!isDescriptionEditing ? (
                                <p>{selectedWorkstream.description}</p>
                            ) : (
                                <textarea value={editedDescription} onChange={(e) => setEditedDescription(e.target.value)} />
                            )}

                            <h3>Module Image
                                {!isImageEditing ? (
                                    <button className="edit-button" onClick={handleEditImage}>Edit Image</button>
                                ) : (
                                    <>
                                        <button className="edit-button" onClick={handleSaveImage}>Save</button>
                                        <button className="edit-button" onClick={handleCancelImage}>Cancel</button>
                                    </>
                                )}
                            </h3>
                            {!isImageEditing ? (
                                selectedWorkstream.image_url && (
                                    <img src={`${API_URL}${selectedWorkstream.image_url}?t=${new Date().getTime()}`} alt={selectedWorkstream.title} className="admin-module-image-wrapper" />
                                )
                            ) : (
                                <input type="file" onChange={(e) => setEditedImage(e.target.files[0])} accept="image/*" />
                            )}
                        </div>

                        {/* Right Column: Chapters and Assessments */}
                        <div className="admin-module-chapters-section">
                            <div className="chapters-header">
                                <h3>Module Chapters</h3>
                                <div className="header-actions">
                                    
                                    <button className="action-link-button" onClick={() => setIsCreatingChapter(true)}>+ Add a chapter</button>
                                </div>
                            </div>
                            <Droppable droppableId="chaptersAndAssessments">
                                {(provided) => (
                                    <div 
                                        className="chapters-assessments-list"
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                    >
                                        {selectedWorkstream.chapters && selectedWorkstream.chapters.flatMap(chapter => ([
                                            { ...chapter, type: 'chapter', id: `ch-${chapter.chapter_id}` },
                                            ...(chapter.assessments ? chapter.assessments.map(assessment => ({ ...assessment, type: 'assessment', id: `as-${assessment.assessment_id}`, parentChapter: chapter })) : [])
                                        ])).map((item, index) => (
                                            <Draggable key={item.id} draggableId={item.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        className={`list-item ${item.type}-item ${snapshot.isDragging ? 'dragging' : ''}`}
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                    >
                                                        <div {...provided.dragHandleProps} className="drag-handle-wrapper">
                                                            <BsGripVertical className="drag-handle" />
                                                        </div>
                                                        <span className="item-title">{item.title}</span>
                                                        <button className="edit-item-button" onClick={() => {
                                                            if (item.type === 'chapter') {
                                                                setEditingChapter(item);
                                                            } else {
                                                                setEditingAssessment(item);
                                                            }
                                                        }}><FaPencilAlt /></button>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                            <p className="reorder-hint">Drag and drop to reorder chapters</p>
                        </div>
                    </div>
                </DragDropContext>
                ) : (
                    // Overview Page
                    <div className="workstream-overview-page">
                        <div className="admin-modules-header">
                            <h1>Workstream Management</h1>
                            <button className="btn-primary" onClick={() => setIsCreatingWorkstream(true)}>
                                <i className="fas fa-plus"></i> New Workstream
                            </button>
                        </div>

                        <div className="admin-modules-filter">
                            <input type="text" placeholder="Search workstreams..." className="form-control" />
                            <button className="btn-secondary">Filter</button>
                        </div>

                        {workstreams.length > 0 ? (
                            <div className="admin-modules-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Workstream Name</th>
                                            <th>Description</th>
                                            <th>Chapters</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {workstreams.map(ws => (
                                            <tr key={ws.workstream_id}>
                                                <td>{ws.title}</td>
                                                <td>{ws.description}</td>
                                                <td>{ws.chapters?.length || 0}</td>
                                                <td>
                                                    <span className={`status-badge ${ws.is_published ? 'published' : 'unpublished'}`}>
                                                        {ws.is_published ? 'Published' : 'Unpublished'}
                                                    </span>
                                                </td>
                                                <td className="actions-cell">
                                                    <button className="btn-icon" onClick={() => setSelectedWorkstream(ws)} title="Manage/Edit Workstream">
                                                        <FaCog />
                                                    </button>
                                                    {ws.is_published ? (
                                                        <button className="btn-icon" onClick={() => handleToggleWorkstreamPublish(ws)} title="Unpublish Workstream">
                                                            <FaEyeSlash />
                                                        </button>
                                                    ) : (
                                                        <button className="btn-icon" onClick={() => handleToggleWorkstreamPublish(ws)} title="Publish Workstream">
                                                            <FaEye />
                                                        </button>
                                                    )}
                                                    <button className="btn-icon btn-delete" onClick={() => handleDeleteWorkstream(ws.workstream_id)} title="Delete Workstream">
                                                        <FaTrash />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="no-content-message">No workstreams available. Add one to get started!</p>
                        )}

                        <div className="admin-modules-pagination">
                            {/* Pagination controls will go here */}
                        </div>
                    </div>
                )}
            </main>

            {/* Modals */}
            <WorkstreamModal
                isOpen={isWorkstreamModalOpen}
                onClose={() => setIsWorkstreamModalOpen(false)}
                onSubmit={handleWorkstreamSubmit}
                currentWorkstream={currentWorkstream}
            />

            <ChapterModal
                isOpen={isChapterModalOpen}
                onClose={() => setIsChapterModalOpen(false)}
                onSubmit={handleChapterSubmit}
                currentChapter={currentChapter}
                workstreamId={selectedWorkstream?.workstream_id}
            />

            <AssessmentModal
                isOpen={isAssessmentModalOpen}
                onClose={() => setIsAssessmentModalOpen(false)}
                onSubmit={handleAssessmentSubmit}
                currentAssessment={currentAssessment}
                chapterId={currentChapter?.chapter_id}
            />

            <QuestionModal
                isOpen={isQuestionModalOpen}
                onClose={() => setIsQuestionModalOpen(false)}
                onSubmit={handleQuestionSubmit}
                currentQuestion={currentQuestion}
            />
        </div>
    );
};

export default A_Modules;