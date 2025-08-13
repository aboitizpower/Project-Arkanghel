// File: components/WorkstreamEdit.jsx

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import AdminSidebar from '../../components/AdminSidebar';
import ChapterEdit from './ChapterEdit';
import AssessmentEdit from './AssessmentEdit';
import axios from 'axios';
import { FaPencilAlt, FaTrash, FaPlus } from 'react-icons/fa';
import '../../styles/admin/WorkstreamEdit.css';
import LoadingOverlay from '../../components/LoadingOverlay';

const API_URL = 'http://localhost:8081';

const WorkstreamEdit = () => {
  const { workstreamId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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

  useEffect(() => {
    setSelectedChapter(null);
    setSelectedAssessment(null);
  }, [location.pathname]);

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


  const handleDragEnd = async (result) => {
    if (!result.destination) {
      return;
    }

    const originalChapters = [...chapters];
    const reorderedChapters = Array.from(originalChapters);
    const [movedItem] = reorderedChapters.splice(result.source.index, 1);
    reorderedChapters.splice(result.destination.index, 0, movedItem);

    // Validate chapters have valid IDs
    const validChapters = reorderedChapters.filter(c => c && c.chapter_id && !isNaN(Number(c.chapter_id)));
    
    if (validChapters.length !== reorderedChapters.length) {
      console.error('Some chapters have invalid IDs:', reorderedChapters);
      setError("Invalid chapter data. Please refresh the page.");
      return;
    }

    // Optimistically update UI
    setChapters(reorderedChapters);
    setError(null);

    const payload = {
      chapters: validChapters.map(c => ({ chapter_id: Number(c.chapter_id) }))
    };

    console.log('Sending reorder payload:', payload);

    try {
      const response = await axios.put(`${API_URL}/chapters/reorder`, payload);

      console.log('Reorder response:', response.data);

      // Update with server response to ensure consistency
      if (response.data.success && response.data.chapters) {
        setChapters(response.data.chapters);
      }
    } catch (err) {
      console.error("Failed to save new chapter order:", err);
      console.error("Error response:", err.response?.data);
      // Revert to original order on error
      setChapters(originalChapters);
      setError(`Failed to save new chapter order: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleCreateChapter = () => {
    navigate(`/admin/workstream/${workstreamId}/chapter/create`);
  };

  if (isLoading) {
    return (
      <div className="workstream-edit-container">
        <AdminSidebar />
        <main className="workstream-edit-main-content">
          <LoadingOverlay loading={isLoading} />
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
          <LoadingOverlay loading={isLoading} />
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
          <LoadingOverlay loading={isLoading} />
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
    const handleChapterUpdated = (updatedChapter) => {
      // Create a fully updated chapter object, ensuring URLs are correct
      const newChapterData = {
        ...selectedChapter,
        ...updatedChapter,
        video_url: updatedChapter.video_filename ? `/chapters/${updatedChapter.chapter_id}/video` : null,
        pdf_url: updatedChapter.pdf_filename ? `/chapters/${updatedChapter.chapter_id}/pdf` : null,
      };

      // Update the selected chapter state for the edit view
      setSelectedChapter(newChapterData);

      // Also update the chapter in the main list for the overview
      setChapters(prevChapters =>
        prevChapters.map(ch =>
          ch.chapter_id === updatedChapter.chapter_id ? newChapterData : ch
        )
      );
    };
    return (
      <div className="workstream-edit-container">
        <AdminSidebar />
        <main className="workstream-edit-main-content">
          <LoadingOverlay loading={isLoading} />
          <ChapterEdit 
            chapter={selectedChapter} 
            onCancel={() => setSelectedChapter(null)} 
            onUpdated={handleChapterUpdated}
          />
        </main>
      </div>
    );
  }

  // Main content layout
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="workstream-edit-main-content">
        <LoadingOverlay loading={isLoading} />

        {selectedAssessment ? (
          <AssessmentEdit 
            assessment={selectedAssessment} 
            workstream={workstream} // Pass the workstream object
            onCancel={() => setSelectedAssessment(null)} 
            onUpdated={() => {
              setSelectedAssessment(null); // Hide the modal
              fetchWorkstream(); // Refresh the workstream data
            }}
          />
        ) : (
          <>
            <div className="workstream-edit-header">
              <button className="back-button" onClick={() => navigate('/admin/workstreams')}>
                &larr; Back to Workstreams
              </button>
              <h1 className="workstream-title">{workstream?.title || 'Loading...'}</h1>
              <button className="btn-primary" onClick={handleSave} disabled={isSubmitting}>
                <FaSave /> Save Changes
              </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="workstream-edit-container">
              {/* Left Column: Details & Chapters */}
              <div className="workstream-edit-left">
                <div className="edit-card">
                  <div className="card-header">
                    <h2 className="card-title">Workstream Details</h2>
                  </div>
                  <div className="card-body">
                    <div className="form-group">
                      <label htmlFor="title">Title</label>
                      <input
                        id="title"
                        type="text"
                        className="form-control"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="description">Description</label>
                      <textarea
                        id="description"
                        className="form-control"
                        rows="4"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      ></textarea>
                    </div>
                    <div className="form-group">
                      <label htmlFor="category">Category</label>
                      <input
                        id="category"
                        type="text"
                        className="form-control"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="edit-card">
                  <div className="card-header">
                    <h2 className="card-title">Chapters</h2>
                    <button className="btn-add" onClick={handleAddChapter}>
                      <FaPlus /> Add Chapter
                    </button>
                  </div>
                  <div className="content-list">
                    <DragDropContext onDragEnd={onDragEnd}>
                      <Droppable droppableId="chapters">
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef}>
                            {chapters.map((chapter, index) => (
                              <Draggable key={chapter.id} draggableId={String(chapter.id)} index={index}>
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className="list-item chapter-item"
                                  >
                                    <span>{chapter.title}</span>
                                    <div className="item-actions">
                                      <button className="btn-edit" onClick={() => handleEditChapter(chapter)}><FaPencilAlt /></button>
                                      <button className="btn-delete" onClick={() => handleDeleteChapter(chapter.id)}><FaTrash /></button>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </div>
                </div>
              </div>

              {/* Right Column: Image & Assessments */}
              <div className="workstream-edit-right">
                <div className="edit-card">
                  <div className="card-header">
                    <h2 className="card-title">Workstream Image</h2>
                  </div>
                  <div className="card-body">
                    <div className="image-upload-container">
                      {previewUrl ? (
                        <img src={previewUrl} alt="Workstream Preview" className="image-preview" />
                      ) : (
                        <div className="image-placeholder">No image uploaded</div>
                      )}
                      <input type="file" id="imageUpload" onChange={handleImageChange} accept="image/*" />
                      <label htmlFor="imageUpload" className="btn-secondary">Upload Image</label>
                    </div>
                  </div>
                </div>

                <div className="edit-card">
                  <div className="card-header">
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
                    {/* Final Assessment Section */}
                    {(workstream?.final_assessments || []).length > 0 && (
                      <div className="assessment-group">
                        <h4 className="assessment-group-title">Final Assessment</h4>
                        {(workstream.final_assessments).map(assessment => (
                          <div key={assessment.assessment_id} className="assessment-item">
                            <span>{assessment.title}</span>
                            <div className="assessment-actions">
                              <button className="btn-edit" onClick={() => setSelectedAssessment(assessment)}><FaPencilAlt /></button>
                              <button className="btn-delete" onClick={() => handleDeleteAssessment(assessment.assessment_id)}><FaTrash /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Chapter-specific assessments */}
                    {(workstream?.chapters || []).map(chapter => 
                      (chapter.assessments && chapter.assessments.length > 0) && (
                        <div key={chapter.id} className="assessment-group">
                          <h4 className="assessment-group-title">Chapter: {chapter.title}</h4>
                          {chapter.assessments.map(assessment => (
                            <div key={assessment.assessment_id} className="assessment-item">
                              <span>{assessment.title}</span>
                              <div className="assessment-actions">
                                <button className="btn-edit" onClick={() => setSelectedAssessment(assessment)}><FaPencilAlt /></button>
                                <button className="btn-delete" onClick={() => handleDeleteAssessment(assessment.assessment_id)}><FaTrash /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}

                    {/* Message if no assessments exist at all */}
                    {(!workstream?.final_assessments || workstream.final_assessments.length === 0) && (workstream?.chapters || []).every(ch => !ch.assessments || ch.assessments.length === 0) && (
                        <p className="empty-list">No assessments yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {selectedChapter && (
              <ChapterEdit
                chapter={selectedChapter}
                onClose={() => setSelectedChapter(null)}
                onSave={(updatedChapter) => {
                  setChapters(chapters.map(c => c.id === updatedChapter.id ? updatedChapter : c));
                  setSelectedChapter(null);
                }}
                workstreamId={workstreamId}
              />
            )}
          </>
        )}
      </main>
    </div>
  );

export default WorkstreamEdit;
