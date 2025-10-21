// File: components/A_Modules.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/admin/A_Modules.css';
import { FaEdit, FaPlus, FaEye, FaEyeSlash, FaTrash, FaCog, FaSearch } from 'react-icons/fa';
import NotificationDialog from '../../components/NotificationDialog';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useNavigate, useLocation } from 'react-router-dom';
import LoadingOverlay from '../../components/LoadingOverlay';
import { useAuth } from '../../auth/AuthProvider';

const API_URL = 'http://localhost:8081';

const PAGE_SIZE = 7;

const A_Modules = () => {
    const [workstreams, setWorkstreams] = useState([]);
    const [filteredWorkstreams, setFilteredWorkstreams] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isPublishing, setIsPublishing] = useState(null);
    const [isDeleting, setIsDeleting] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(PAGE_SIZE);
    const [notification, setNotification] = useState({ message: '', type: 'success', isVisible: false });
    const [confirmModal, setConfirmModal] = useState({ isVisible: false, workstreamId: null, workstreamTitle: '' });
    const navigate = useNavigate();
    const { user } = useAuth();

    const fetchWorkstreams = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${API_URL}/workstreams`, {
                headers: {
                    'Authorization': `Bearer ${user?.token}`
                }
            });
            // Handle both old and new response formats
            const workstreamsData = response.data.workstreams || response.data;
            setWorkstreams(workstreamsData);
            setFilteredWorkstreams(workstreamsData);
        } catch (err) {
            setError('Failed to fetch workstreams');
            console.error('Error fetching workstreams:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user?.token) {
            fetchWorkstreams();
        }
    }, [user]);

    // Filter workstreams based on search term
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredWorkstreams(workstreams);
        } else {
            const filtered = workstreams.filter(ws =>
                ws.title.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredWorkstreams(filtered);
        }
    }, [searchTerm, workstreams]);

    // Reset to first page when search/filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filteredWorkstreams.length, searchTerm]);

    // Pagination logic
    const totalPages = Math.ceil(filteredWorkstreams.length / pageSize);
    const paginatedWorkstreams = filteredWorkstreams.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const handleTogglePublish = async (workstream) => {
        // Prevent multiple clicks
        if (isPublishing === workstream.id) {
            return;
        }
        
        const newPublishStatus = !workstream.is_published;
        setIsPublishing(workstream.id);
        
        try {
            const response = await axios.put(`${API_URL}/workstreams/${workstream.id}/publish`, {
                is_published: newPublishStatus
            }, {
                headers: {
                    'Authorization': `Bearer ${user?.token}`
                }
            });
            
            console.log('API Response:', {
                status: response.status,
                data: response.data
            });
            
            // Check for successful response (200 or 201) and handle both old and new response formats
            if (response.status === 200 || response.status === 201) {
                // Update the workstream state immediately for better UX
                setWorkstreams(prevWorkstreams => 
                    prevWorkstreams.map(ws => 
                        ws.id === workstream.id 
                            ? { ...ws, is_published: newPublishStatus }
                            : ws
                    )
                );
                
                // Reset publishing state FIRST to re-enable button
                setIsPublishing(null);
                
                // Handle both old and new response formats for the message
                const notificationMessage = response.data?.message || 
                    `Workstream "${workstream.title}" has been ${newPublishStatus ? 'published' : 'unpublished'} successfully!`;
                
                console.log('Setting notification:', notificationMessage);
                
                setNotification({
                    message: notificationMessage,
                    type: 'success',
                    isVisible: true
                });
                
                console.log('Publish toggle successful - notification set');
            } else {
                console.warn('Unexpected response status:', response.status);
                setIsPublishing(null);
                setNotification({
                    message: 'Unexpected response from server. Please refresh to see current status.',
                    type: 'warning',
                    isVisible: true
                });
            }
        } catch (err) {
            console.error('Failed to toggle publish:', err);
            console.error('Error response:', err.response?.data);
            console.error('Error status:', err.response?.status);
            
            // Handle structured error responses
            const errorMessage = err.response?.data?.error || 
                                err.response?.data?.message || 
                                'Failed to update publish status. Please try again.';
            
            setError('Failed to update publish status');
            setNotification({
                message: errorMessage,
                type: 'error',
                isVisible: true
            });
            
            // Reset publishing state on error
            setIsPublishing(null);
        }
    };

    const handleDeleteWorkstream = (workstream) => {
        setConfirmModal({
            isVisible: true,
            workstreamId: workstream.id,
            workstreamTitle: workstream.title
        });
    };

    const confirmDeleteWorkstream = async () => {
        const { workstreamId } = confirmModal;
        setConfirmModal({ isVisible: false, workstreamId: null, workstreamTitle: '' });
        
        setIsDeleting(workstreamId);
        try {
            const response = await axios.delete(`${API_URL}/workstreams/${workstreamId}`, {
            headers: {
                'Authorization': `Bearer ${user?.token}`
            }
        });
            fetchWorkstreams();
            
            // Handle both old and new response formats for the message
            const successMessage = response.data?.message || 'Workstream deleted successfully!';
            
            setNotification({
                message: successMessage,
                type: 'success',
                isVisible: true
            });
        } catch (err) {
            console.error('Error deleting workstream:', err);
            console.error('Error response:', err.response?.data);
            
            // Handle structured error responses
            const errorMessage = err.response?.data?.error || 
                               err.response?.data?.message || 
                               'Failed to delete workstream. Please try again.';
            
            setError('Failed to delete workstream');
            setNotification({
                message: errorMessage,
                type: 'error',
                isVisible: true
            });
        } finally {
            setIsDeleting(null);
        }
    };

    const cancelDeleteWorkstream = () => {
        setConfirmModal({ isVisible: false, workstreamId: null, workstreamTitle: '' });
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    const clearSearch = () => {
        setSearchTerm('');
    };

    if (isLoading) {
        return (
            <div className="admin-modules-container">
                <AdminSidebar />
                <main className="admin-modules-main-content">
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p>Loading workstreams...</p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main">
                <LoadingOverlay loading={isLoading} />
                <div className="admin-header">
                    <div className="header-left">
                        <h1 className="admin-title">Workstream Management</h1>
                        {/* filter-info can stay here if needed */}
                    </div>
                    <div className="header-right">
                        <div className="search-container">
                            <input 
                                type="text" 
                                placeholder="Search workstreams..." 
                                className="search-input"
                                value={searchTerm}
                                onChange={handleSearch}
                            />
                            {searchTerm && (
                                <button 
                                    onClick={clearSearch} 
                                    className="clear-search"
                                    title="Clear search"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        <button 
                            className="btn-primary" 
                            onClick={() => navigate('/admin/workstream/create')}
                        >
                            + New Workstream
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="error-message">
                        {error}
                        <button onClick={() => setError(null)} className="error-close">×</button>
                    </div>
                )}

                {filteredWorkstreams.length > 0 ? (
                    <>
                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th className="th-title">Title</th>
                                    <th>Description</th>
                                    <th className="th-chapters">Chapters</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedWorkstreams.map(ws => (
                                    <tr key={ws.id}>
                                        <td className="workstream-title">{ws.title}</td>
                                        <td className="workstream-description">
                                            {ws.description?.length > 100 
                                                ? `${ws.description.substring(0, 100)}...` 
                                                : ws.description
                                            }
                                        </td>
                                        <td className="chapters-count">
                                            {typeof ws.chapters_count !== 'undefined'
                                                ? ws.chapters_count
                                                : (ws.chapters?.length || 0)}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${ws.is_published ? 'published' : 'unpublished'}`}>
                                                {ws.is_published ? 'Published' : 'Unpublished'}
                                            </span>
                                        </td>
                                        <td className="actions-cell">
                                            <button 
                                                className="btn-icon" 
                                                onClick={() => navigate(`/admin/workstream/${ws.id}/edit`)} 
                                                title="Manage/Edit Workstream"
                                            >
                                                <FaCog />
                                            </button>
                                            <button 
                                                className="btn-icon" 
                                                onClick={() => handleTogglePublish(ws)} 
                                                title={ws.is_published ? 'Unpublish' : 'Publish'}
                                                disabled={isPublishing === ws.id}
                                            >
                                                {isPublishing === ws.id ? (
                                                    <div className="spinner-small"></div>
                                                ) : (
                                                    ws.is_published ? <FaEyeSlash /> : <FaEye />
                                                )}
                                            </button>
                                            <button 
                                                className="btn-icon btn-delete" 
                                                onClick={() => handleDeleteWorkstream(ws)} 
                                                title="Delete Workstream"
                                                disabled={isDeleting === ws.id}
                                            >
                                                {isDeleting === ws.id ? (
                                                    <div className="spinner-small"></div>
                                                ) : (
                                                    <FaTrash />
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="pagination-container">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                disabled={currentPage === 1} 
                                className="pagination-button"
                            >
                                «
                            </button>
                            <span className="pagination-info">{currentPage}</span>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                                disabled={currentPage === totalPages} 
                                className="pagination-button"
                            >
                                »
                            </button>
                        </div>
                    )}
                    </>
                ) : searchTerm ? (
                    <div className="no-content-message">
                        <p>No workstreams found matching "{searchTerm}".</p>
                        <button onClick={clearSearch} className="btn-secondary">
                            Clear Search
                        </button>
                    </div>
                ) : (
                    <div className="no-content-message">
                        <p>No workstreams available. Add one to get started!</p>
                        <button 
                            onClick={() => navigate('/admin/workstream/create')}
                            className="btn-primary"
                        >
                            Create Your First Workstream
                        </button>
                    </div>
                )}
                <NotificationDialog
                    message={notification.message}
                    type={notification.type}
                    isVisible={notification.isVisible}
                    onClose={() => setNotification(prev => ({ ...prev, isVisible: false }))}
                />
                <ConfirmationModal
                    isVisible={confirmModal.isVisible}
                    title="Delete Workstream"
                    message={`Are you sure you want to delete "${confirmModal.workstreamTitle}" and all its content? This action cannot be undone.`}
                    confirmText="Delete"
                    cancelText="Cancel"
                    onConfirm={confirmDeleteWorkstream}
                    onCancel={cancelDeleteWorkstream}
                    type="danger"
                />
            </main>
        </div>
    );
};

export default A_Modules;
