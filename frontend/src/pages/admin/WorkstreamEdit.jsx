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
import NotificationDialog from '../../components/NotificationDialog';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useAuth } from '../../auth/AuthProvider';

import API_URL from '../../config/api';

const WorkstreamEdit = () => {
  const { workstreamId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [workstream, setWorkstream] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditing, setIsEditing] = useState({ title: false, description: false, image: false, deadline: false });
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedDeadline, setEditedDeadline] = useState('');
  const [newImage, setNewImage] = useState(null);

  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [notification, setNotification] = useState({ message: '', type: 'success', isVisible: false });
  const [confirmModal, setConfirmModal] = useState({ isVisible: false, type: '', id: null, title: '' });

  // Fetch workstream data
  const fetchWorkstream = useCallback(async () => {
    if (!workstreamId || !user?.token) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/workstreams/${workstreamId}/complete`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      const data = response.data;
      console.log('Fetched workstream data:', data);
      console.log('Fetched workstream deadline:', data.deadline); // Debug log

      // The backend now returns a single workstream object with 'chapters' and 'final_assessments' arrays.
      // Ensure we preserve all properties including deadline
      setWorkstream({
        ...data,
        final_assessments: data.final_assessments || []
      });
      console.log('Set workstream state to:', data); // Debug log
      console.log('Workstream state deadline:', data.deadline); // Debug log 

      const chaptersWithUrls = (data.chapters || []).map(chapter => ({
        ...chapter,
        video_url: chapter.video_filename ? `/chapters/${chapter.chapter_id}/video` : null,
        pdf_url: chapter.pdf_filename ? `/chapters/${chapter.chapter_id}/pdf` : null,
      }));
      setChapters(chaptersWithUrls);

      setEditedTitle(data.title);
      setEditedDescription(data.description);
      // Convert MySQL datetime format to datetime-local format for input
      if (data.deadline) {
        // MySQL format: "2025-10-04 04:14:00" -> datetime-local format: "2025-10-04T04:14"
        const deadlineForInput = data.deadline.replace(' ', 'T').slice(0, 16);
        setEditedDeadline(deadlineForInput);
      } else {
        setEditedDeadline('');
      }

    } catch (error) {
      console.error('Failed to fetch workstream:', error);
      setError('Failed to fetch workstream');
    } finally {
      setIsLoading(false);
    }
  }, [workstreamId, user]);

  useEffect(() => {
    if (workstreamId) {
      fetchWorkstream();
    }
  }, [fetchWorkstream, workstreamId]);

  useEffect(() => {
    setSelectedChapter(null);
    setSelectedAssessment(null);
  }, [location.pathname]);

  const handleDeleteChapter = (chapter) => {
    setConfirmModal({
      isVisible: true,
      type: 'chapter',
      id: chapter.chapter_id,
      title: chapter.title
    });
  };

  const confirmDeleteChapter = async () => {
    const { id } = confirmModal;
    setConfirmModal({ isVisible: false, type: '', id: null, title: '' });
    
    try {
      await axios.delete(`${API_URL}/chapters/${id}`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });
      fetchWorkstream();
      setNotification({
        message: 'Chapter deleted successfully!',
        type: 'success',
        isVisible: true
      });
    } catch (err) {
      console.error('Error deleting chapter:', err);
      setNotification({
        message: 'Failed to delete chapter. Please try again.',
        type: 'error',
        isVisible: true
      });
    }
  };

  const handleDeleteAssessment = (assessment) => {
    setConfirmModal({
      isVisible: true,
      type: 'assessment',
      id: assessment.assessment_id,
      title: assessment.title
    });
  };

  const confirmDeleteAssessment = async () => {
    const { id } = confirmModal;
    setConfirmModal({ isVisible: false, type: '', id: null, title: '' });
    
    try {
      await axios.delete(`${API_URL}/assessments/${id}`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });
      fetchWorkstream();
      setNotification({
        message: 'Assessment deleted successfully!',
        type: 'success',
        isVisible: true
      });
    } catch (err) {
      console.error('Failed to delete assessment:', err);
      setNotification({
        message: 'Failed to delete assessment. Please try again.',
        type: 'error',
        isVisible: true
      });
    }
  };

  const cancelDelete = () => {
    setConfirmModal({ isVisible: false, type: '', id: null, title: '' });
  };

  const handleSave = async (field) => {
    if (!workstream) {
      setError('Cannot save: workstream data is not available.');
      return;
    }

    try {
      let payload;
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user?.token}`
      };

      if (field === 'image') {
        if (!newImage) {
          return handleCancel('image');
        }
        payload = new FormData();
        payload.append('title', workstream.title);
        payload.append('description', workstream.description);
        if (workstream.deadline) payload.append('deadline', workstream.deadline);
        payload.append('image', newImage);
        headers['Content-Type'] = 'multipart/form-data';
      } else {
        // Construct a clean payload with only the necessary fields
        let deadlineValue = workstream.deadline;
        if (field === 'deadline') {
          if (editedDeadline && editedDeadline.trim() !== '') {
            // Send datetime-local format directly without timezone conversion
            // Format: "2025-10-04T04:14" -> "2025-10-04 04:14:00"
            deadlineValue = editedDeadline.replace('T', ' ') + ':00';
          } else {
            deadlineValue = null;
          }
        }
        
        payload = {
          title: field === 'title' ? editedTitle : workstream.title,
          description: field === 'description' ? editedDescription : workstream.description,
          deadline: deadlineValue,
        };
        
        console.log('Sending payload:', payload); // Debug log
        console.log('editedDeadline:', editedDeadline); // Debug log
      }

            const response = await axios.put(`${API_URL}/workstreams/${workstreamId}`, payload, { headers });

      // Success: backend now returns the full updated workstream object.
      // Use this data directly to update state, avoiding a race condition.
      const updatedWorkstream = response.data.workstream || response.data;
      console.log('Received updated workstream:', updatedWorkstream); // Debug log
      console.log('Updated workstream deadline:', updatedWorkstream.deadline); // Debug log
      if (updatedWorkstream) {
        setWorkstream(updatedWorkstream);
        setChapters(updatedWorkstream.chapters || []);
        setEditedTitle(updatedWorkstream.title || '');
        setEditedDescription(updatedWorkstream.description || '');
        // Convert MySQL datetime format back to datetime-local format
        if (updatedWorkstream.deadline) {
          // MySQL format: "2025-10-04 04:14:00" -> datetime-local format: "2025-10-04T04:14"
          const deadlineForInput = updatedWorkstream.deadline.replace(' ', 'T').slice(0, 16);
          setEditedDeadline(deadlineForInput);
        } else {
          setEditedDeadline('');
        }
        console.log('Updated editedDeadline to:', updatedWorkstream.deadline ? new Date(updatedWorkstream.deadline).toISOString().slice(0, 16) : ''); // Debug log
      }

      setIsEditing({ ...isEditing, [field]: false });
      if (field === 'image') setNewImage(null);

      // Show success notification
      const fieldNames = {
        title: 'Title',
        description: 'Description', 
        deadline: 'Deadline',
        image: 'Image'
      };
      
      setNotification({
        message: `${fieldNames[field]} updated successfully!`,
        type: 'success',
        isVisible: true
      });

    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
      setError(`Failed to update ${field}. Please try again.`);
      
      // Show error notification
      setNotification({
        message: `Failed to update ${field}. Please try again.`,
        type: 'error',
        isVisible: true
      });
    }
  };

  const handleCancel = (field) => {
    setIsEditing({ ...isEditing, [field]: false });
    // Reset fields to original values, only if workstream is loaded
    if (workstream) {
      if (field === 'title') setEditedTitle(workstream.title);
      if (field === 'description') setEditedDescription(workstream.description);
      if (field === 'deadline') {
        if (workstream.deadline) {
          // MySQL format: "2025-10-04 04:14:00" -> datetime-local format: "2025-10-04T04:14"
          const deadlineForInput = workstream.deadline.replace(' ', 'T').slice(0, 16);
          setEditedDeadline(deadlineForInput);
        } else {
          setEditedDeadline('');
        }
      }
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
      const response = await axios.put(`${API_URL}/chapters/reorder`, payload, {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });

      console.log('Reorder response:', response.data);

      // Update with server response to ensure consistency
      if (response.data.success && response.data.chapters) {
        setChapters(response.data.chapters);
        setNotification({
          message: 'Chapter order updated successfully!',
          type: 'success',
          isVisible: true
        });
      }
    } catch (err) {
      console.error("Failed to save new chapter order:", err);
      console.error("Error response:", err.response?.data);
      // Revert to original order on error
      setChapters(originalChapters);
      setError(`Failed to save new chapter order: ${err.response?.data?.error || err.message}`);
      setNotification({
        message: 'Failed to update chapter order. Please try again.',
        type: 'error',
        isVisible: true
      });
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

  if (selectedAssessment) {
    return (
      <div className="workstream-edit-container">
        <AdminSidebar />
        <main className="workstream-edit-main-content">
          <LoadingOverlay loading={isLoading} />
          {selectedAssessment && (
            <AssessmentEdit 
              assessment={selectedAssessment} 
              onCancel={() => setSelectedAssessment(null)} 
              onUpdated={() => {
                setSelectedAssessment(null); // Close the edit modal
                fetchWorkstream(); // Refetch the data to show the updated title
              }}
            />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="workstream-edit-container">
      <AdminSidebar />
      <main className="workstream-edit-main-content">
        <LoadingOverlay loading={isLoading} />
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
                    <p className="inline-value">{workstream?.title || 'Loading...'}</p>
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
                    <p className="inline-value">{workstream?.description || 'Loading...'}</p>
                  )}
                </div>

                <div className="divider-horizontal"></div>

                {/* Inline Deadline Edit */}
                <div className="inline-edit-section">
                  <div className="inline-edit-header">
                    <label>Workstream Deadline</label>
                    {!isEditing.deadline && (
                      <button className="btn-inline-edit" onClick={() => setIsEditing({ ...isEditing, deadline: true })}>
                        <FaPencilAlt /> Edit deadline
                      </button>
                    )}
                  </div>
                  {isEditing.deadline ? (
                    <div className="inline-edit-content">
                      <input 
                        type="datetime-local"
                        value={editedDeadline}
                        onChange={(e) => setEditedDeadline(e.target.value)}
                        className="inline-input"
                      />
                      <small className="form-text">Leave empty for no deadline. Students will not be able to access this workstream after the deadline.</small>
                      <div className="inline-edit-actions">
                        <button className="btn-cancel" onClick={() => handleCancel('deadline')}>Cancel</button>
                        <button className="btn-save" onClick={() => handleSave('deadline')}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <p className="inline-value">
                      {(() => {
                        if (!workstream) {
                          return 'Loading...';
                        }
                        
                        console.log('Rendering deadline - workstream.deadline:', workstream.deadline); // Debug log
                        console.log('Rendering deadline - typeof workstream.deadline:', typeof workstream.deadline); // Debug log
                        
                        if (workstream.deadline) {
                          console.log('Deadline exists, value:', workstream.deadline);
                          console.log('Deadline type:', typeof workstream.deadline);
                          console.log('Deadline length:', workstream.deadline.length);
                          console.log('Deadline truthy check:', !!workstream.deadline);
                          
                          const parsedDate = new Date(workstream.deadline);
                          console.log('Rendering deadline - parsed date:', parsedDate); // Debug log
                          console.log('Rendering deadline - parsed date valid:', !isNaN(parsedDate.getTime())); // Debug log
                          
                          if (!isNaN(parsedDate.getTime())) {
                            const formatted = parsedDate.toLocaleString();
                            console.log('Formatted date:', formatted);
                            return formatted;
                          } else {
                            return `Invalid date: ${workstream.deadline}`;
                          }
                        } else {
                          console.log('No deadline - workstream.deadline is falsy:', workstream.deadline);
                        }
                        
                        return 'No deadline set';
                      })()}
                    </p>
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
                        ) : workstream?.image_url && (
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
                      {workstream?.image_url && (
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
                <DragDropContext onDragEnd={handleDragEnd}>
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
                                  <div className="chapter-content">
                                    <span>{ch.title}</span>
                                    <span className={`status-badge ${ch.is_published ? 'published' : 'unpublished'}`}>
                                      {ch.is_published ? 'PUBLISHED' : 'UNPUBLISHED'}
                                    </span>
                                  </div>
                                  <div className="chapter-actions">
                                    <button className="btn-edit" onClick={() => setSelectedChapter(ch)}><FaPencilAlt /></button>
                                    <button className="btn-delete" onClick={() => handleDeleteChapter(ch)}><FaTrash /></button>
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
                  {/* Chapter-specific assessments */}
                  {(workstream?.chapters || []).map(chapter => 
                    (chapter.assessments || []).map(assessment => (
                      <div key={assessment.assessment_id} className="assessment-item">
                        <span>{assessment.title}</span>
                        <div className="assessment-actions">
                          <button className="btn-edit" onClick={() => setSelectedAssessment(assessment)}><FaPencilAlt /></button>
                          <button className="btn-delete" onClick={() => handleDeleteAssessment(assessment)}><FaTrash /></button>
                        </div>
                      </div>
                    ))
                  )}



                  {/* Message if no assessments exist */}
                  {/* Final assessments */}
                  {(workstream?.final_assessments || []).map(assessment => (
                    <div key={assessment.assessment_id} className="assessment-item final-assessment">
                      <span>{assessment.title} (Final)</span>
                      <div className="assessment-actions">
                        <button className="btn-edit" onClick={() => setSelectedAssessment(assessment)}><FaPencilAlt /></button>
                        <button className="btn-delete" onClick={() => handleDeleteAssessment(assessment)}><FaTrash /></button>
                      </div>
                    </div>
                  ))}

                  {/* Message if no assessments exist */}
                  {(workstream?.chapters?.flatMap(c => c.assessments).length === 0 && workstream?.final_assessments?.length === 0) && (
                      <p className="empty-list">No assessments yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <NotificationDialog
          message={notification.message}
          type={notification.type}
          isVisible={notification.isVisible}
          onClose={() => setNotification(prev => ({ ...prev, isVisible: false }))}
        />
        <ConfirmationModal
          isVisible={confirmModal.isVisible}
          title={confirmModal.type === 'chapter' ? 'Delete Chapter' : 'Delete Assessment'}
          message={
            confirmModal.type === 'chapter' 
              ? `Are you sure you want to delete "${confirmModal.title}"? All associated assessments and user progress will also be deleted.`
              : `Are you sure you want to delete "${confirmModal.title}"? All associated questions and answers will also be deleted.`
          }
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmModal.type === 'chapter' ? confirmDeleteChapter : confirmDeleteAssessment}
          onCancel={cancelDelete}
          type="danger"
        />
      </main>
    </div>
  );
};

export default WorkstreamEdit;
