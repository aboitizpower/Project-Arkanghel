// File: components/ChapterEdit.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '../../components/AdminSidebar';
import axios from 'axios';
import '../../styles/admin/ChapterEdit.css';

const API_URL = 'http://localhost:8081';

const ChapterEdit = ({ chapter, onCancel, onUpdated }) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(chapter.title);

  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState(chapter.content);

  const [isEditingVideo, setIsEditingVideo] = useState(false);
  const [newVideo, setNewVideo] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSaveTitle = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await axios.put(`${API_URL}/chapters/${chapter.chapter_id}`, {
        ...chapter,
        title: editedTitle
      });
      if (onUpdated) onUpdated();
      setIsEditingTitle(false);
    } catch (err) {
      setError('Failed to update title');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveContent = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await axios.put(`${API_URL}/chapters/${chapter.chapter_id}`, {
        ...chapter,
        content: editedContent
      });
      if (onUpdated) onUpdated();
      setIsEditingContent(false);
    } catch (err) {
      setError('Failed to update content');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveVideo = async () => {
    if (!newVideo) return;
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.append('title', chapter.title);
    formData.append('content', chapter.content);
    formData.append('video', newVideo);
    try {
      await axios.put(`${API_URL}/chapters/${chapter.chapter_id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (onUpdated) onUpdated();
      setIsEditingVideo(false);
    } catch (err) {
      setError('Failed to update video');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="chapter-edit-container">
      <AdminSidebar />
      <main className="chapter-edit-main-content">
        <div className="chapter-edit-header">
          <button className="back-button" onClick={onCancel || (() => navigate('/admin/modules'))}>
            &larr; Back
          </button>
        </div>
        <div className="chapter-edit-page">
          <h2>Edit Chapter</h2>

          <div className="chapter-edit-content">
            <div className="chapter-edit-left">
              <div className="edit-card">
                <h4>Title</h4>
                {isEditingTitle ? (
                  <>
                    <input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="form-control"
                    />
                    <div className="edit-actions">
                      <button className="btn-save" onClick={handleSaveTitle} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save'}
                      </button>
                      <button className="btn-cancel" onClick={() => setIsEditingTitle(false)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>{chapter.title}</p>
                    <button onClick={() => setIsEditingTitle(true)}>Edit</button>
                  </>
                )}
              </div>

              <div className="edit-card">
                <h4>Video</h4>
                {isEditingVideo ? (
                  <>
                    <div className="file-input-wrapper">
                      <input type="file" accept="video/*" onChange={(e) => setNewVideo(e.target.files[0])} />
                    </div>
                    <div className="edit-actions">
                      <button className="btn-save" onClick={handleSaveVideo} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save'}
                      </button>
                      <button className="btn-cancel" onClick={() => setIsEditingVideo(false)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    {chapter.video_url && (
                      <video controls>
                        <source src={`http://localhost:8081${chapter.video_url}`} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    )}
                    <button onClick={() => setIsEditingVideo(true)}>Change Video</button>
                  </>
                )}
              </div>
            </div>

            <div className="chapter-edit-right">
              <div className="edit-card description-card">
                <h4>Content</h4>
                {isEditingContent ? (
                  <div className="editing-view">
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="form-control description-editor"
                    />
                    <div className="edit-actions">
                      <button className="btn-save" onClick={handleSaveContent} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save'}
                      </button>
                      <button className="btn-cancel" onClick={() => setIsEditingContent(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="display-view">
                    <p className="description-display">{chapter.content}</p>
                    <button onClick={() => setIsEditingContent(true)}>Edit</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>
      </main>
    </div>
  );
};

export default ChapterEdit;
