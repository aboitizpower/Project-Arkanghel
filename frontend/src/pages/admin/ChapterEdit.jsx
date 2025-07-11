// File: components/ChapterEdit.jsx

import React, { useState } from 'react';
import { FaPencilAlt, FaRegFilePdf, FaVideo, FaBookOpen, FaSave, FaTimes } from 'react-icons/fa';
import axios from 'axios';
import '../../styles/admin/ChapterEdit.css';

const API_URL = 'http://localhost:8081';

const ChapterEdit = ({ chapter, onCancel, onUpdated }) => {
  const [editedTitle, setEditedTitle] = useState(chapter.title);
  const [editedContent, setEditedContent] = useState(chapter.content);
  const [newVideo, setNewVideo] = useState(null);
  const [newPdf, setNewPdf] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isPublished, setIsPublished] = useState(chapter.is_published);

  const [isEditing, setIsEditing] = useState({ title: false, content: false, video: false, pdf: false });

  const handleSave = async (field) => {
    setIsSubmitting(true);
    setError(null);
    try {
      let payload = {};
      let url = `${API_URL}/chapters/${chapter.chapter_id}`;
      let headers = { 'Content-Type': 'application/json' };

      if (field === 'title') {
        payload = { title: editedTitle };
      } else if (field === 'content') {
        payload = { content: editedContent };
      } else if (field === 'video' && newVideo) {
        const formData = new FormData();
        formData.append('video_file', newVideo);
        payload = formData;
        url = `${API_URL}/chapters/${chapter.chapter_id}/upload-video`;
        headers = { 'Content-Type': 'multipart/form-data' };
      } else if (field === 'pdf' && newPdf) {
        const formData = new FormData();
        formData.append('pdf_file', newPdf);
        payload = formData;
        url = `${API_URL}/chapters/${chapter.chapter_id}/upload-pdf`;
        headers = { 'Content-Type': 'multipart/form-data' };
      } else {
        setIsSubmitting(false);
        return; // Nothing to save
      }

      await axios.post(url, payload, { headers });
      setIsEditing(prev => ({ ...prev, [field]: false }));
      onUpdated(); // Refresh data in parent

    } catch (err) {
      setError(`Failed to save ${field}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishToggle = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const newPublishStatus = !isPublished;
      await axios.put(`${API_URL}/chapters/${chapter.chapter_id}/publish`, { is_published: newPublishStatus });
      setIsPublished(newPublishStatus);
      // No longer calling onUpdated() here to prevent navigating back to workstream edit
      // onUpdated(); 
    } catch (err) {
      console.error('Error toggling publish status:', err);
      setError('Failed to update publish status.');
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
        <button className="back-button" onClick={onCancel}>&larr; Back to module setup</button>
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
                      <button className="btn-cancel" onClick={() => handleCancel('title')}><FaTimes /> Cancel</button>
                      <button className="btn-save" onClick={() => handleSave('title')} disabled={isSubmitting}><FaSave /> Save</button>
                    </div>
                  </div>
                ) : <p>{chapter.title}</p>}
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
                      <button className="btn-cancel" onClick={() => handleCancel('content')}><FaTimes /> Cancel</button>
                      <button className="btn-save" onClick={() => handleSave('content')} disabled={isSubmitting}><FaSave /> Save</button>
                    </div>
                  </div>
                ) : <p>{chapter.content || 'No description provided.'}</p>}
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
                      <button className="btn-cancel" onClick={() => handleCancel('video')}><FaTimes /> Cancel</button>
                      <button className="btn-save" onClick={() => handleSave('video')} disabled={!newVideo || isSubmitting}><FaSave /> Save</button>
                    </div>
                  </div>
                ) : (
                  chapter.video_url ? (
                    <video src={`${API_URL}${chapter.video_url}`} controls className="video-preview" />
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
                      <button className="btn-cancel" onClick={() => handleCancel('pdf')}><FaTimes /> Cancel</button>
                      <button className="btn-save" onClick={() => handleSave('pdf')} disabled={!newPdf || isSubmitting}><FaSave /> Save</button>
                    </div>
                  </div>
                ) : (
                  chapter.pdf_url ? (
                    <a href={`${API_URL}${chapter.pdf_url}`} target="_blank" rel="noopener noreferrer">View PDF</a>
                  ) : <p>No PDF uploaded.</p>
                )}
              </div>
            </div>
          </div>
        </div>
        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
};

export default ChapterEdit;
