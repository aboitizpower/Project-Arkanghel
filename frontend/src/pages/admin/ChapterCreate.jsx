// File: components/ChapterCreate.jsx

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminSidebar from '../../components/AdminSidebar';
import axios from 'axios';
import '../../styles/admin/ChapterCreate.css';
import NotificationDialog from '../../components/NotificationDialog';

const API_URL = 'http://localhost:8081';

const ChapterCreate = () => {
  const { workstreamId } = useParams();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [video, setVideo] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: 'success', isVisible: false });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('workstream_id', workstreamId);
      formData.append('title', title);
      formData.append('content', content);
      if (video) formData.append('video', video);
      if (pdf) formData.append('pdf', pdf);

      const response = await axios.post(`${API_URL}/chapters`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setNotification({
        message: 'Chapter created successfully!',
        type: 'success',
        isVisible: true
      });
      
      // Navigate after a short delay to show notification
      setTimeout(() => {
        navigate(`/admin/workstream/${workstreamId}/edit`);
      }, 1500);
    } catch (err) {
      setError('Failed to create chapter');
      setNotification({
        message: 'Failed to create chapter. Please try again.',
        type: 'error',
        isVisible: true
      });
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="chapter-create-container">
      <AdminSidebar />
      <main className="chapter-create-main-content">
        <div className="chapter-create-header">
          <button className="back-button" onClick={() => navigate(`/admin/workstream/${workstreamId}/edit`)}>
            &larr; Back to Workstream
          </button>
        </div>
        <div className="chapter-create-page">
          <h2>Create New Chapter</h2>
          <p className="subtitle">Fill out the details below to add a new chapter.</p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="chapter-create-form">
            <div className="form-group">
              <label htmlFor="chapter-title">Chapter Title</label>
              <input
                id="chapter-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="form-control"
                placeholder="Enter a title"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="chapter-content">Chapter Content</label>
              <textarea
                id="chapter-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="form-control"
                rows="8"
                placeholder="Enter chapter content"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="chapter-video">Chapter Video</label>
              <input
                id="chapter-video"
                type="file"
                onChange={(e) => setVideo(e.target.files[0])}
                className="form-control"
                accept="video/*"
              />
            </div>

            {video && (
              <div className="video-preview">
                <video controls>
                  <source src={URL.createObjectURL(video)} type={video.type} />
                  Your browser does not support the video tag.
                </video>
                <div className="video-info">
                  <p>Selected: {video.name}</p>
                  <button type="button" className="remove-video" onClick={() => setVideo(null)}>
                    Remove Video
                  </button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="chapter-pdf">Chapter PDF</label>
              <input
                id="chapter-pdf"
                type="file"
                onChange={(e) => setPdf(e.target.files[0])}
                className="form-control"
                accept=".pdf"
              />
            </div>

            {pdf && (
              <div className="pdf-preview">
                <p>Selected: {pdf.name}</p>
                <button type="button" className="remove-pdf" onClick={() => setPdf(null)}>
                  Remove PDF
                </button>
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Chapter'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => navigate(`/admin/workstream/${workstreamId}/edit`)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
        <NotificationDialog
          message={notification.message}
          type={notification.type}
          isVisible={notification.isVisible}
          onClose={() => setNotification(prev => ({ ...prev, isVisible: false }))}
        />
      </main>
    </div>
  );
};

export default ChapterCreate;
