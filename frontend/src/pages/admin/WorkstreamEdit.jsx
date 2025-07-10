// File: components/WorkstreamEdit.jsx

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import AdminSidebar from '../../components/AdminSidebar';
import ChapterEdit from './ChapterEdit';
import AssessmentEdit from './AssessmentEdit';
import axios from 'axios';
import { FaPencilAlt, FaTrash, FaPlus } from 'react-icons/fa';
import '../../styles/admin/WorkstreamEdit.css';

const API_URL = 'http://localhost:8081';

const WorkstreamEdit = () => {
  const { workstreamId } = useParams();
  const navigate = useNavigate();
  const [workstream, setWorkstream] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditing, setIsEditing] = useState({ title: false, description: false, image: false });
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [newImage, setNewImage] = useState(null);

  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedAssessment, setSelectedAssessment] = useState(null);

  // Fetch workstream data
  const fetchWorkstream = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/workstreams/${workstreamId}/complete`);
      const data = response.data;
      console.log('Fetched workstream data:', data);

      if (data) {
        setWorkstream(data);
        // Map chapters to include full URLs for video and PDF based on their existence
        const chaptersWithUrls = (data.chapters || []).map(chapter => ({
          ...chapter,
          video_url: chapter.video_filename ? `/chapters/${chapter.chapter_id}/video` : null,
          pdf_url: chapter.pdf_filename ? `/chapters/${chapter.chapter_id}/pdf` : null,
        }));
        setChapters(chaptersWithUrls);
        setEditedTitle(data.title || '');
        setEditedDescription(data.description || '');
      } else {
        // Handle case where API returns 200 OK but data is null (e.g., not found)
        setError('Workstream not found.');
        setWorkstream(null);
      }
    } catch (err) {
      setError('Failed to fetch workstream');
      console.error('Error fetching workstream:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workstreamId]);

  useEffect(() => {
    if (workstreamId) {
      fetchWorkstream();
    }
  }, [fetchWorkstream, workstreamId]);

  const handleDeleteChapter = async (chapterId) => {
    if (window.confirm('Are you sure you want to delete this chapter? All associated assessments and user progress will also be deleted.')) {
      try {
        await axios.delete(`${API_URL}/chapters/${chapterId}`);
        fetchWorkstream(); // Re-fetch workstream data to update the UI
      } catch (err) {
        console.error('Failed to delete chapter:', err);
        setError('Failed to delete chapter. Please try again.');
      }
    }
  };

  const handleDeleteAssessment = async (assessmentId) => {
    if (window.confirm('Are you sure you want to delete this assessment? All associated questions and answers will also be deleted.')) {
      try {
        await axios.delete(`${API_URL}/assessments/${assessmentId}`);
        fetchWorkstream(); // Re-fetch workstream data to update the UI
      } catch (err) {
        console.error('Failed to delete assessment:', err);
        setError('Failed to delete assessment. Please try again.');
      }
    }
  };

  const handleSave = async (field) => {
    if (!workstream) {
      setError('Cannot save: workstream data is not available.');
      return;
    }

    try {
      let payload;
      const headers = { 'Content-Type': 'application/json' };

      if (field === 'image') {
        if (!newImage) {
          return handleCancel('image');
        }
        payload = new FormData();
        payload.append('title', workstream.title);
        payload.append('description', workstream.description);
        payload.append('image', newImage);
        headers['Content-Type'] = 'multipart/form-data';
      } else {
        // Construct a clean payload with only the necessary fields
        payload = {
          title: field === 'title' ? editedTitle : workstream.title,
          description: field === 'description' ? editedDescription : workstream.description,
        };
      }

      const response = await axios.put(`${API_URL}/workstreams/${workstreamId}`, payload, { headers });

      // Success: backend now returns the full updated workstream object.
      // Use this data directly to update state, avoiding a race condition.
      const updatedWorkstream = response.data;
      if (updatedWorkstream) {
        setWorkstream(updatedWorkstream);
        setChapters(updatedWorkstream.chapters || []);
        setEditedTitle(updatedWorkstream.title || '');
        setEditedDescription(updatedWorkstream.description || '');
      }

      setIsEditing({ ...isEditing, [field]: false });
      if (field === 'image') setNewImage(null);

    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
      setError(`Failed to update ${field}. Please try again.`);
    }
  };

  const handleCancel = (field) => {
    setIsEditing({ ...isEditing, [field]: false });
    // Reset fields to original values, only if workstream is loaded
    if (workstream) {
      if (field === 'title') setEditedTitle(workstream.title);
      if (field === 'description') setEditedDescription(workstream.description);
    }
    if (field === 'image') setNewImage(null);
  };

  const handleReorderChapters = async (reorderedChapters) => {
    try {
      await axios.post(`${API_URL}/workstreams/${workstreamId}/reorder-chapters`, {
        chapters: reorderedChapters.map((chapter, index) => ({
          chapter_id: chapter.chapter_id,
          order_index: index,
        })),
      });
      // Optionally re-fetch to confirm changes, though optimistic update is usually enough
      fetchWorkstream(); 
    } catch (err) {
      console.error('Failed to reorder chapters:', err);
      // If the API call fails, you might want to revert the state
      // For simplicity, we'll just log the error here
      setError('Failed to save new chapter order.');
    }
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return; // Dropped outside the list

    const reordered = Array.from(chapters);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);

    setChapters(reordered);
    handleReorderChapters(reordered);
  };

  if (isLoading) {
    return (
      <div className="workstream-edit-container">
        <AdminSidebar />
        <main className="workstream-edit-main-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading workstream...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workstream-edit-container">
        <AdminSidebar />
        <main className="workstream-edit-main-content">
          <div className="error-message">
            {error}
            <button onClick={() => navigate('/admin/modules')} className="btn-secondary">
              Back to Workstreams
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!workstream) {
    // After loading, if there's no error but still no workstream, it means not found.
    return (
      <div className="workstream-edit-container">
        <AdminSidebar />
        <main className="workstream-edit-main-content">
          <div className="error-message">
            Workstream not found.
            <button onClick={() => navigate('/admin/modules')} className="btn-secondary">
              Back to Modules
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (selectedChapter) {
    return (
      <div className="workstream-edit-container">
        <AdminSidebar />
        <main className="workstream-edit-main-content">
          <ChapterEdit 
            chapter={selectedChapter} 
            onCancel={() => setSelectedChapter(null)} 
            onUpdated={() => {
              setSelectedChapter(null);
              fetchWorkstream();
            }}
          />
        </main>
      </div>
    );
  }

  if (selectedAssessment) {
    return (
      <div className="workstream-edit-container">
        <AdminSidebar />
        <main className="workstream-edit-main-content">
          <AssessmentEdit 
            assessment={selectedAssessment} 
            onCancel={() => setSelectedAssessment(null)} 
            onUpdated={() => {
              setSelectedAssessment(null);
              fetchWorkstream();
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="workstream-edit-container">
      <AdminSidebar />
      <main className="workstream-edit-main-content">
        <div className="workstream-edit-header">
          <button className="back-button" onClick={() => navigate('/admin/modules')}>
            &larr; Back to All Workstreams
          </button>
        </div>
        <div className="workstream-edit-page">
          <div className="workstream-edit-layout">
            {/* Left Panel: Workstream Details */}
            <div className="workstream-details-panel">
              <div className="edit-card workstream-info-card">
                
                {/* Inline Title Edit */}
                <div className="inline-edit-section">
                  <div className="inline-edit-header">
                    <label>Workstream Title</label>
                    {!isEditing.title && (
                      <button className="btn-inline-edit" onClick={() => setIsEditing({ ...isEditing, title: true })}>
                        <FaPencilAlt /> Edit title
                      </button>
                    )}
                  </div>
                  {isEditing.title ? (
                    <div className="inline-edit-content">
                      <input 
                        type="text" 
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="inline-input"
                      />
                      <div className="inline-edit-actions">
                        <button className="btn-cancel" onClick={() => handleCancel('title')}>Cancel</button>
                        <button className="btn-save" onClick={() => handleSave('title')}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <p className="inline-value">{workstream.title}</p>
                  )}
                </div>

                <div className="divider-horizontal"></div>

                {/* Inline Description Edit */}
                <div className="inline-edit-section">
                  <div className="inline-edit-header">
                    <label>Workstream Description</label>
                    {!isEditing.description && (
                      <button className="btn-inline-edit" onClick={() => setIsEditing({ ...isEditing, description: true })}>
                        <FaPencilAlt /> Edit description
                      </button>
                    )}
                  </div>
                  {isEditing.description ? (
                    <div className="inline-edit-content">
                      <textarea 
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        className="inline-textarea"
                      />
                      <div className="inline-edit-actions">
                        <button className="btn-cancel" onClick={() => handleCancel('description')}>Cancel</button>
                        <button className="btn-save" onClick={() => handleSave('description')}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <p className="inline-value">{workstream.description}</p>
                  )}
                </div>

                <div className="divider-horizontal"></div>

                {/* Inline Image Edit */}
                <div className="inline-edit-section">
                  <div className="inline-edit-header">
                    <label>Workstream Image</label>
                    {!isEditing.image && (
                      <button className="btn-inline-edit" onClick={() => setIsEditing({ ...isEditing, image: true })}>
                        <FaPencilAlt /> Edit image
                      </button>
                    )}
                  </div>
                  {isEditing.image ? (
                     <div className="inline-edit-content">
                      <input 
                        type="file" 
                        onChange={(e) => setNewImage(e.target.files[0])}
                        className="inline-input-file"
                      />
                      <div className="workstream-image-box">
                        {newImage ? (
                           <img src={URL.createObjectURL(newImage)} alt="New preview" className="workstream-image" />
                        ) : workstream.image_url && (
                          <img src={`${API_URL}${workstream.image_url}?t=${new Date().getTime()}`} alt="Current" className="workstream-image" />
                        )}
                      </div>
                      <div className="inline-edit-actions">
                        <button className="btn-cancel" onClick={() => handleCancel('image')}>Cancel</button>
                        <button className="btn-save" onClick={() => handleSave('image')} disabled={!newImage}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="workstream-image-box">
                      {workstream.image_url && (
                        <img src={`${API_URL}${workstream.image_url}?t=${new Date().getTime()}`} alt="Workstream" className="workstream-image" />
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Upper Right Panel: Chapters */}
            <div className="workstream-chapters-panel">
              <div className="edit-card section-card">
                <div className="section-header-container">
                  <div className="section-header">Chapters</div>
                  <button 
                    className="btn-add" 
                    onClick={() => navigate(`/admin/workstream/${workstreamId}/chapter/create`)}
                  >
                    <FaPlus /> Add
                  </button>
                </div>
                <div className="divider"></div>
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="chapters">
                    {(provided) => (
                      <div 
                        className="content-list"
                        {...provided.droppableProps} 
                        ref={provided.innerRef}
                      >
                        {chapters.length > 0 ? (
                          chapters.map((ch, index) => (
                            <Draggable key={ch.chapter_id} draggableId={String(ch.chapter_id)} index={index}>
                              {(provided) => (
                                <div 
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className="chapter-item"
                                >
                                  <span>{ch.title}</span>
                                  <div className="chapter-actions">
                                    <button className="btn-edit" onClick={() => setSelectedChapter(ch)}><FaPencilAlt /></button>
                                    <button className="btn-delete" onClick={() => handleDeleteChapter(ch.chapter_id)}><FaTrash /></button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))
                        ) : (
                          <p className="empty-list">No chapters yet.</p>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            </div>

            {/* Lower Right Panel: Assessments */}
            <div className="workstream-assessments-panel">
              <div className="edit-card section-card">
                <div className="section-header-container">
                  <div className="section-header">Assessments</div>
                  <button 
                    className="btn-add" 
                    onClick={() => navigate(`/admin/workstream/${workstreamId}/assessment/create`)}
                  >
                    <FaPlus /> Add
                  </button>
                </div>
                <div className="divider"></div>
                <div className="content-list">
                  {workstream && workstream.chapters && workstream.chapters.flatMap(ch => ch.assessments || []).length > 0 ? (
                    workstream.chapters
                      .flatMap(ch => ch.assessments || [])
                      .map(assessment => (
                        <div key={assessment.assessment_id} className="assessment-item">
                          <span>{assessment.title}</span>
                          <div className="assessment-actions">
                            <button className="btn-edit" onClick={() => setSelectedAssessment(assessment)}><FaPencilAlt /></button>
                            <button className="btn-delete" onClick={() => handleDeleteAssessment(assessment.assessment_id)}><FaTrash /></button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="empty-list">No assessments yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );



  return (
    <div className="workstream-edit-container">
      <AdminSidebar />
      <main className="workstream-edit-main-content">
        <div className="workstream-edit-page">
          <div className="workstream-edit-layout">
            {/* Left Panel: Workstream Details */}
            <div className="workstream-details-panel">
              <div className="edit-card workstream-info-card">
                
                {/* Inline Title Edit */}
                <div className="inline-edit-section">
                  <div className="inline-edit-header">
                    <label>Workstream Title</label>
                    {!isEditing.title && (
                      <button className="btn-inline-edit" onClick={() => setIsEditing({ ...isEditing, title: true })}>
                        <FaPencilAlt /> Edit title
                      </button>
                    )}
                  </div>
                  {isEditing.title ? (
                    <div className="inline-edit-content">
                      <input 
                        type="text" 
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="inline-input"
                      />
                      <div className="inline-edit-actions">
                        <button className="btn-cancel" onClick={() => handleCancel('title')}>Cancel</button>
                        <button className="btn-save" onClick={() => handleSave('title')}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <p className="inline-value">{workstream.title}</p>
                  )}
                </div>

                <div className="divider-horizontal"></div>

                {/* Inline Description Edit */}
                <div className="inline-edit-section">
                  <div className="inline-edit-header">
                    <label>Workstream Description</label>
                    {!isEditing.description && (
                      <button className="btn-inline-edit" onClick={() => setIsEditing({ ...isEditing, description: true })}>
                        <FaPencilAlt /> Edit description
                      </button>
                    )}
                  </div>
                  {isEditing.description ? (
                    <div className="inline-edit-content">
                      <textarea 
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        className="inline-textarea"
                      />
                      <div className="inline-edit-actions">
                        <button className="btn-cancel" onClick={() => handleCancel('description')}>Cancel</button>
                        <button className="btn-save" onClick={() => handleSave('description')}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <p className="inline-value">{workstream.description}</p>
                  )}
                </div>

                <div className="divider-horizontal"></div>

                {/* Inline Image Edit */}
                <div className="inline-edit-section">
                  <div className="inline-edit-header">
                    <label>Workstream Image</label>
                    {!isEditing.image && (
                      <button className="btn-inline-edit" onClick={() => setIsEditing({ ...isEditing, image: true })}>
                        <FaPencilAlt /> Edit image
                      </button>
                    )}
                  </div>
                  {isEditing.image ? (
                     <div className="inline-edit-content">
                      <input 
                        type="file" 
                        onChange={(e) => setNewImage(e.target.files[0])}
                        className="inline-input-file"
                      />
                      <div className="workstream-image-box">
                        {newImage ? (
                           <img src={URL.createObjectURL(newImage)} alt="New preview" className="workstream-image" />
                        ) : workstream.image_url && (
                          <img src={`${API_URL}${workstream.image_url}?t=${new Date().getTime()}`} alt="Current" className="workstream-image" />
                        )}
                      </div>
                      <div className="inline-edit-actions">
                        <button className="btn-cancel" onClick={() => handleCancel('image')}>Cancel</button>
                        <button className="btn-save" onClick={() => handleSave('image')} disabled={!newImage}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="workstream-image-box">
                      {workstream.image_url && (
                        <img src={`${API_URL}${workstream.image_url}?t=${new Date().getTime()}`} alt="Workstream" className="workstream-image" />
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Upper Right Panel: Chapters */}
            <div className="workstream-chapters-panel">
              <div className="edit-card section-card">
                <div className="section-header-container">
                  <div className="section-header">Chapters</div>
                  <button 
                    className="btn-add" 
                    onClick={() => navigate(`/admin/workstream/${workstreamId}/chapter/create`)}
                  >
                    <FaPlus /> Add
                  </button>
                </div>
                <div className="divider"></div>
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="chapters">
                    {(provided) => (
                      <div 
                        className="content-list"
                        {...provided.droppableProps} 
                        ref={provided.innerRef}
                      >
                        {chapters.length > 0 ? (
                          chapters.map((ch, index) => (
                            <Draggable key={ch.chapter_id} draggableId={String(ch.chapter_id)} index={index}>
                              {(provided) => (
                                <div 
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className="chapter-item"
                                >
                                  <span>{ch.title}</span>
                                  <div className="chapter-actions">
                                    <button className="btn-edit" onClick={() => setSelectedChapter(ch)}><FaPencilAlt /></button>
                                    <button className="btn-delete" onClick={() => handleDeleteChapter(ch.chapter_id)}><FaTrash /></button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))
                        ) : (
                          <p className="empty-list">No chapters yet.</p>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            </div>

            {/* Lower Right Panel: Assessments */}
            <div className="workstream-assessments-panel">
              <div className="edit-card section-card">
                <div className="section-header-container">
                  <div className="section-header">Assessments</div>
                  <button 
                    className="btn-add" 
                    onClick={() => navigate(`/admin/workstream/${workstreamId}/assessment/create`)}
                  >
                    <FaPlus /> Add
                  </button>
                </div>
                <div className="divider"></div>
                <div className="content-list">
                  {workstream && workstream.chapters && workstream.chapters.flatMap(ch => ch.assessments || []).length > 0 ? (
                    workstream.chapters
                      .flatMap(ch => ch.assessments || [])
                      .map(assessment => (
                        <div key={assessment.assessment_id} className="assessment-item">
                          <span>{assessment.title}</span>
                          <div className="assessment-actions">
                            <button className="btn-edit" onClick={() => setSelectedAssessment(assessment)}><FaPencilAlt /></button>
                            <button className="btn-delete" onClick={() => handleDeleteAssessment(assessment.assessment_id)}><FaTrash /></button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="empty-list">No assessments yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          {selectedChapter ? (
            <ChapterEdit 
              chapter={selectedChapter}
              onCancel={() => setSelectedChapter(null)}
              onUpdated={() => {
                setSelectedChapter(null);
                fetchWorkstream();
              }}
            />
          ) : (
            <div className="workstream-edit-main-content">
              {/* ... rest of the main view ... */}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default WorkstreamEdit;
