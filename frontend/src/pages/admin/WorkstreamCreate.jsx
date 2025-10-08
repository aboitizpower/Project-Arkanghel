// File: components/WorkstreamCreate.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '../../components/AdminSidebar';
import axios from 'axios';
import '../../styles/admin/WorkstreamCreate.css';
import NotificationDialog from '../../components/NotificationDialog';
import { useAuth } from '../../auth/AuthProvider';

const API_URL = 'http://localhost:8081';

const WorkstreamCreate = () => {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState(null);
    const [deadline, setDeadline] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState({ message: '', type: 'success', isVisible: false });
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Check if user is authenticated
        if (!user || !user.token) {
            setError('You must be logged in to create a workstream.');
            return;
        }
        
        // Frontend validation to match backend requirements
        if (!title || title.trim().length === 0) {
            setError('Title is required.');
            return;
        }
        
        if (title.length < 3 || title.length > 100) {
            setError('Title must be between 3 and 100 characters.');
            return;
        }
        
        if (!description || description.trim().length === 0) {
            setError('Description is required.');
            return;
        }
        
        if (description.length < 10 || description.length > 1000) {
            setError('Description must be between 10 and 1000 characters.');
            return;
        }

        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('description', description.trim());
        
        // Convert deadline to MySQL format (same as edit functionality)
        if (deadline && deadline.trim() !== '') {
            const deadlineValue = deadline.replace('T', ' ') + ':00';
            formData.append('deadline', deadlineValue);
            console.log('WorkstreamCreate sending deadline:', deadlineValue); // Debug log
        }
        
        if (image) formData.append('image', image);

        setIsLoading(true);
        try {
            const response = await axios.post(`${API_URL}/workstreams`, formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${user.token}`
                }
            });
            
            setNotification({
                message: 'Workstream created successfully!',
                type: 'success',
                isVisible: true
            });
            
            // Navigate after a short delay to show notification
            setTimeout(() => {
                navigate('/admin/modules');
            }, 1500);
        } catch (err) {
            console.error('Error creating workstream:', err);
            
            // Extract specific error message from backend response
            const errorMessage = err.response?.data?.error || 
                               err.response?.data?.message || 
                               'Failed to create workstream. Please try again.';
            
            setError(errorMessage);
            setNotification({
                message: errorMessage,
                type: 'error',
                isVisible: true
            });
            
            console.error('Backend error response:', err.response?.data);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="workstream-create-container">
            <AdminSidebar />
            <main className="workstream-create-main-content">
                <div className="workstream-create-header">
                    <button className="back-button" onClick={() => navigate('/admin/modules')}>
                        &larr; Back to Workstreams
                    </button>
                </div>
                <div className="workstream-create-page">
                    <h2>Create New Workstream</h2>
                    <p className="subtitle">Fill out the details below to add a new workstream.</p>

                    {error && <div className="error-message">{error}</div>}

                    <form onSubmit={handleSubmit} className="workstream-create-form">
                        <div className="form-group">
                            <label htmlFor="ws-title">Workstream Title</label>
                            <input
                                id="ws-title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="form-control"
                                placeholder="Enter a title"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="ws-desc">Workstream Description</label>
                            <textarea
                                id="ws-desc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="form-control"
                                rows="5"
                                placeholder="Enter a description (minimum 10 characters)"
                                required
                            />
                            <small className="form-text">Description must be between 10 and 1000 characters.</small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="ws-deadline">Workstream Deadline (optional)</label>
                            <input
                                id="ws-deadline"
                                type="datetime-local"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                className="form-control"
                                placeholder="Select deadline date and time"
                            />
                            <small className="form-text">Leave empty for no deadline. Students will not be able to access this workstream after the deadline.</small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="ws-image">Workstream Image</label>
                            <input
                                id="ws-image"
                                type="file"
                                onChange={(e) => setImage(e.target.files[0])}
                                className="form-control"
                                accept="image/*"
                            />
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn-primary" disabled={isLoading}>
                                {isLoading ? 'Creating...' : 'Create Workstream'}
                            </button>
                            <button type="button" className="btn-secondary" onClick={() => navigate('/admin/modules')}>
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

export default WorkstreamCreate;
