// File: components/ChapterEdit.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/admin/ChapterEdit.css';
import NotificationDialog from '../../components/NotificationDialog';
import { FaPencilAlt, FaSave, FaTimes } from 'react-icons/fa';

const API_URL = 'http://localhost:8081';

const ChapterEdit = ({ chapter, onCancel, onUpdated }) => {
  const [editedTitle, setEditedTitle] = useState(chapter.title);
  const [editedContent, setEditedContent] = useState(chapter.content);
  const [newVideo, setNewVideo] = useState(null);
  const [newPdf, setNewPdf] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isPublished, setIsPublished] = useState(chapter.is_published);
  const [notification, setNotification] = useState({ message: '', type: 'success', isVisible: false });

  const [isEditing, setIsEditing] = useState({ title: false, content: false, video: false, pdf: false });

  // Update local state when chapter prop changes
  useEffect(() => {
    setEditedTitle(chapter.title);
    setEditedContent(chapter.content);
    setIsPublished(chapter.is_published);
  }, [chapter]);

  const handleSave = async (field) => {
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    let hasData = false;

    if (field === 'title' && editedTitle !== chapter.title) {
      formData.append('title', editedTitle);
      formData.append('content', chapter.content);
      formData.append('order_index', chapter.order_index || 0);
      hasData = true;
    } else if (field === 'content' && editedContent !== chapter.content) {
      formData.append('title', chapter.title);
      formData.append('content', editedContent);
      formData.append('order_index', chapter.order_index || 0);
      hasData = true;
    } else if (field === 'video' && newVideo) {
      formData.append('title', chapter.title);
      formData.append('content', chapter.content);
      formData.append('order_index', chapter.order_index || 0);
      formData.append('video', newVideo);
      hasData = true;
    } else if (field === 'pdf' && newPdf) {
      formData.append('title', chapter.title);
      formData.append('content', chapter.content);
      formData.append('order_index', chapter.order_index || 0);
      formData.append('pdf', newPdf);
      hasData = true;
    }

    if (!hasData) {
      setIsSubmitting(false);
      setIsEditing(prev => ({ ...prev, [field]: false }));
      return;
    }

    try {
      const response = await axios.put(`${API_URL}/chapters/${chapter.chapter_id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setIsEditing(prev => ({ ...prev, [field]: false }));
      
      // Update local state with the response data
      if (response.data) {
        if (field === 'title') {
          setEditedTitle(response.data.title);
        } else if (field === 'content') {
          setEditedContent(response.data.content);
        }
        // Reset file inputs after successful upload
        if (field === 'video') {
          setNewVideo(null);
        } else if (field === 'pdf') {
          setNewPdf(null);
        }
      }
      
      onUpdated(response.data); // Pass updated chapter data back
    } catch (err) {
      console.error(`Failed to save ${field}:`, err.response ? err.response.data : err.message);
      setError(`Failed to save ${field}. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishToggle = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const newPublishStatus = !isPublished;
      const response = await axios.put(`${API_URL}/chapters/${chapter.chapter_id}/publish`, { is_published: newPublishStatus });
      setIsPublished(newPublishStatus);
      
      // Show notification
      setNotification({
        message: `Chapter "${chapter.title}" has been ${newPublishStatus ? 'published' : 'unpublished'} successfully!`,
        type: 'success',
        isVisible: true
      });
      
      // Update the chapter data with the response
      if (response.data && onUpdated) {
        onUpdated(response.data);
      }
    } catch (err) {
      console.error('Error toggling publish status:', err);
      setError('Failed to update publish status.');
      setNotification({
        message: 'Failed to update publish status. Please try again.',
        type: 'error',
        isVisible: true
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = (field) => {
    setIsEditing(prev => ({ ...prev, [field]: false }));
    // Reset state if needed
    if (field === 'title') setEditedTitle(chapter.title);
    if (field === 'content') setEditedContent(chapter.content);
    if (field === 'video') setNewVideo(null);
    if (field === 'pdf') setNewPdf(null);
  };

  return (
    <div className="module-chapter-creation">
      <div className="page-header">
        <button className="back-button" onClick={onCancel}>&larr; Back to Workstream Setup</button>
        <div className="header-center">
  
        </div>
        <button 
          className={`btn-${isPublished ? 'unpublish' : 'publish'}`} 
          onClick={handlePublishToggle} 
          disabled={isSubmitting}
        >
          {isPublished ? 'Unpublish' : 'Publish'}
        </button>
      </div>

      <div className="customize-chapter-section">
        <div className="chapter-layout-grid">
          {/* Left Column */}
          <div className="chapter-details-column">
            <div className="edit-card-modern">
              <div className="edit-card-header">
                <h3>Chapter Title</h3>
                {!isEditing.title && <button className="btn-inline-edit" onClick={() => setIsEditing(prev => ({ ...prev, title: true }))}><FaPencilAlt /> Edit title</button>}
              </div>
              <div className="edit-card-body">
                {isEditing.title ? (
                  <div className="inline-edit-content">
                    <input type="text" value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} className="inline-input" />
                    <div className="inline-edit-actions">
                      <button className="btn-save" onClick={() => handleSave('title')} disabled={isSubmitting}><FaSave /> Save</button>
                      <button className="btn-cancel" onClick={() => handleCancel('title')}><FaTimes /> Cancel</button>
                    </div>
                  </div>
                ) : <p>{editedTitle}</p>}
              </div>
            </div>
            <div className="edit-card-modern">
              <div className="edit-card-header">
                <h3>Description</h3>
                {!isEditing.content && <button className="btn-inline-edit" onClick={() => setIsEditing(prev => ({ ...prev, content: true }))}><FaPencilAlt /> Edit description</button>}
              </div>
              <div className="edit-card-body">
                {isEditing.content ? (
                  <div className="inline-edit-content">
                    <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} className="inline-textarea" />
                    <div className="inline-edit-actions">
                      <button className="btn-save" onClick={() => handleSave('content')} disabled={isSubmitting}><FaSave /> Save</button>
                      <button className="btn-cancel" onClick={() => handleCancel('content')}><FaTimes /> Cancel</button>
                    </div>
                  </div>
                ) : <p>{editedContent || 'No description provided.'}</p>}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="chapter-media-column">
            <div className="edit-card-modern">
              <div className="edit-card-header">
                <h3>Chapter Video</h3>
                {!isEditing.video && <button className="btn-inline-edit" onClick={() => setIsEditing(prev => ({ ...prev, video: true }))}><FaPencilAlt /> Edit video</button>}
              </div>
              <div className="edit-card-body">
                {isEditing.video ? (
                  <div className="inline-edit-content">
                    <input type="file" accept="video/*" onChange={(e) => setNewVideo(e.target.files[0])} className="inline-input-file" />
                    <div className="inline-edit-actions">
                      <button className="btn-save" onClick={() => handleSave('video')} disabled={!newVideo || isSubmitting}><FaSave /> Save</button>
                      <button className="btn-cancel" onClick={() => handleCancel('video')}><FaTimes /> Cancel</button>
                    </div>
                  </div>
                 ) : (
                   chapter.video_filename ? (
                     <video src={`${API_URL}/chapters/${chapter.chapter_id}/video`} controls className="video-preview" />
                   ) : <p>No video uploaded.</p>
                 )}
              </div>
            </div>
            <div className="edit-card-modern">
              <div className="edit-card-header">
                <h3>PDF Attachment</h3>
                {!isEditing.pdf && <button className="btn-inline-edit" onClick={() => setIsEditing(prev => ({ ...prev, pdf: true }))}><FaPencilAlt /> Edit PDF</button>}
              </div>
              <div className="edit-card-body">
                {isEditing.pdf ? (
                  <div className="inline-edit-content">
                    <input type="file" accept=".pdf" onChange={(e) => setNewPdf(e.target.files[0])} className="inline-input-file" />
                    <div className="inline-edit-actions">
                      <button className="btn-save" onClick={() => handleSave('pdf')} disabled={!newPdf || isSubmitting}><FaSave /> Save</button>
                      <button className="btn-cancel" onClick={() => handleCancel('pdf')}><FaTimes /> Cancel</button>
                    </div>
                  </div>
                 ) : (
                   chapter.pdf_filename ? (
                     <a href={`${API_URL}/chapters/${chapter.chapter_id}/pdf`} target="_blank" rel="noopener noreferrer">View PDF</a>
                   ) : <p>No PDF uploaded.</p>
                 )}
              </div>
            </div>
          </div>
        </div>
        {error && <div className="error-message">{error}</div>}
        <NotificationDialog
          message={notification.message}
          type={notification.type}
          isVisible={notification.isVisible}
          onClose={() => setNotification(prev => ({ ...prev, isVisible: false }))}
        />
      </div>
    </div>
  );
};

export default ChapterEdit;
