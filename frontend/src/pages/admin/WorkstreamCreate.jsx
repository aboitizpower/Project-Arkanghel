// File: components/WorkstreamCreate.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '../../components/AdminSidebar';
import axios from 'axios';
import '../../styles/admin/WorkstreamCreate.css';
import NotificationDialog from '../../components/NotificationDialog';

const API_URL = 'http://localhost:8081';

const WorkstreamCreate = () => {
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
        if (!title) {
            setError('Title is required.');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        
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
                headers: { 'Content-Type': 'multipart/form-data' }
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
            setError('Failed to create workstream.');
            setNotification({
                message: 'Failed to create workstream. Please try again.',
                type: 'error',
                isVisible: true
            });
            console.error(err);
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
                                placeholder="Enter a description"
                            />
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
