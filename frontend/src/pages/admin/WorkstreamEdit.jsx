// File: components/WorkstreamEdit.jsx

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  const [isEditingImage, setIsEditingImage] = useState(false);
  const [newImage, setNewImage] = useState(null);

  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedAssessment, setSelectedAssessment] = useState(null);

  // Fetch workstream data
  const fetchWorkstream = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/workstreams/${workstreamId}/complete`);
      console.log('Fetched workstream data:', response.data);
      setWorkstream(response.data);
      setEditedTitle(response.data.title);
      setEditedDescription(response.data.description);
    } catch (err) {
      setError('Failed to fetch workstream');
      console.error('Error fetching workstream:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (workstreamId) {
      fetchWorkstream();
    }
  }, [workstreamId]);

  const handleSaveTitle = async () => {
    try {
      await axios.put(`${API_URL}/workstreams/${workstreamId}`, {
        ...workstream,
        title: editedTitle
      });
      fetchWorkstream();
      setIsEditingTitle(false);
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  const handleSaveDescription = async () => {
    try {
      await axios.put(`${API_URL}/workstreams/${workstreamId}`, {
        ...workstream,
        description: editedDescription
      });
      fetchWorkstream();
      setIsEditingDescription(false);
    } catch (err) {
      console.error('Failed to update description:', err);
    }
  };

  const handleSaveImage = async () => {
    if (!newImage) return;
    const formData = new FormData();
    formData.append('title', workstream.title);
    formData.append('description', workstream.description);
    formData.append('image', newImage);
    try {
      await axios.put(`${API_URL}/workstreams/${workstreamId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchWorkstream();
      setIsEditingImage(false);
    } catch (err) {
      console.error('Failed to update image:', err);
    }
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

  if (error || !workstream) {
    return (
      <div className="workstream-edit-container">
        <AdminSidebar />
        <main className="workstream-edit-main-content">
          <div className="error-message">
            {error || 'Workstream not found'}
            <button onClick={() => navigate('/admin/modules')} className="btn-secondary">
              Back to Modules
            </button>
          </div>
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
          <h2>Edit Workstream</h2>

          <div className="workstream-edit-content">
            {/* Left Column - Current Content */}
            <div className="workstream-edit-left">
              <div className="edit-card workstream-info-card">
                <h3 className="workstream-title">{workstream.title}</h3>
                <p className="workstream-description">{workstream.description}</p>
                <div className="divider" style={{ margin: '1.5rem 0 1.5rem 0' }}></div>
                <div className="workstream-image-box">
                  {workstream.image_url && (
                    <img
                      src={`${API_URL}${workstream.image_url}?t=${new Date().getTime()}`}
                      alt="Workstream"
                      className="workstream-image"
                    />
                  )}
                </div>
                <div className="edit-btn-row">
                  <button 
                    className="edit-btn" 
                    onClick={() => {
                      setIsEditingTitle(true);
                      setIsEditingDescription(true);
                      setIsEditingImage(true);
                    }}
                  >
                    <FaPencilAlt /> Edit
                  </button>
                </div>

                {(isEditingTitle || isEditingDescription || isEditingImage) && (
                  <div className="edit-modal-overlay">
                    <div className="edit-modal">
                      <label htmlFor="title" className="edit-label">Title</label>
                      <input
                        id="title"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="form-control"
                      />
                      <label htmlFor="description" className="edit-label">Description</label>
                      <textarea
                        id="description"
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        className="form-control"
                      />
                      <label htmlFor="image" className="edit-label">Image</label>
                      <div className="file-input-wrapper">
                        <input type="file" accept="image/*" onChange={(e) => setNewImage(e.target.files[0])} />
                      </div>
                      <div className="edit-actions edit-actions-row">
                        <button className="btn-save" onClick={async () => {
                          await handleSaveTitle();
                          await handleSaveDescription();
                          await handleSaveImage();
                          setIsEditingTitle(false);
                          setIsEditingDescription(false);
                          setIsEditingImage(false);
                        }}>Save</button>
                        <button className="btn-cancel" onClick={() => {
                          setIsEditingTitle(false);
                          setIsEditingDescription(false);
                          setIsEditingImage(false);
                          setEditedTitle(workstream.title);
                          setEditedDescription(workstream.description);
                          setNewImage(null);
                        }}>Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Management */}
            <div className="workstream-edit-right">
              <div className="edit-card section-card">
                <div className="section-header">Chapters</div>
                <button 
                  className="btn-add" 
                  onClick={() => navigate(`/admin/workstream/${workstreamId}/chapter/create`)}
                >
                  <FaPlus /> Add Chapter
                </button>
                <div className="divider"></div>
                {workstream.chapters && workstream.chapters.length > 0 ? (
                  workstream.chapters.map(ch => (
                    <div key={ch.chapter_id} className="chapter-item">
                      <span>{ch.title}</span>
                      <button 
                        className="btn-icon" 
                        onClick={() => setSelectedChapter(ch)}
                        title="Edit Chapter"
                      >
                        <FaPencilAlt />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="empty-list">No chapters added yet</p>
                )}
              </div>

              <div className="edit-card section-card">
                <div className="section-header">All Assessments</div>
                <button 
                  className="btn-add" 
                  onClick={() => navigate(`/admin/workstream/${workstreamId}/assessment/create`)}
                >
                  <FaPlus /> Add Assessment
                </button>
                <div className="divider"></div>
                {workstream.chapters && workstream.chapters
                  .flatMap(ch => ch.assessments || [])
                  .length > 0 ? (
                  workstream.chapters
                    .flatMap(ch => ch.assessments || [])
                    .map(assessment => (
                      <div key={assessment.assessment_id} className="assessment-item">
                        <span>{assessment.title}</span>
                        <button 
                          className="btn-icon" 
                          onClick={() => setSelectedAssessment(assessment)}
                          title="Edit Assessment"
                        >
                          <FaPencilAlt />
                        </button>
                      </div>
                    ))
                ) : (
                  <p className="empty-list">No assessments added yet</p>
                )}
              </div>
            </div>
          </div>

          {selectedChapter && (
            <ChapterEdit
              chapter={selectedChapter}
              onCancel={() => setSelectedChapter(null)}
              onUpdated={() => {
                setSelectedChapter(null);
                fetchWorkstream();
              }}
            />
          )}

          {selectedAssessment && (
            <AssessmentEdit
              assessment={selectedAssessment}
              onCancel={() => setSelectedAssessment(null)}
              onUpdated={() => {
                setSelectedAssessment(null);
                fetchWorkstream();
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default WorkstreamEdit;
