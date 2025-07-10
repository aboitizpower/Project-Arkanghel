// File: components/A_Modules.jsx

import React, { useEffect, useState } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/admin/A_Modules.css';
import axios from 'axios';
import { FaCog, FaTrash, FaEye, FaEyeSlash, FaSearch } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:8081';

const A_Modules = () => {
    const [workstreams, setWorkstreams] = useState([]);
    const [filteredWorkstreams, setFilteredWorkstreams] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isPublishing, setIsPublishing] = useState(null);
    const [isDeleting, setIsDeleting] = useState(null);
    const navigate = useNavigate();

    const fetchWorkstreams = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${API_URL}/workstreams`);
            setWorkstreams(response.data);
            setFilteredWorkstreams(response.data);
        } catch (err) {
            setError('Failed to fetch workstreams');
            console.error('Error fetching workstreams:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkstreams();
    }, []);

    // Filter workstreams based on search term
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredWorkstreams(workstreams);
        } else {
            const filtered = workstreams.filter(ws =>
                ws.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ws.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredWorkstreams(filtered);
        }
    }, [searchTerm, workstreams]);

    const handleTogglePublish = async (workstream) => {
        setIsPublishing(workstream.workstream_id);
        try {
            const response = await axios.put(`${API_URL}/workstreams/${workstream.workstream_id}/publish`, {
                is_published: !workstream.is_published
            });
            if (response.status === 200) {
                fetchWorkstreams();
            }
        } catch (err) {
            console.error('Failed to toggle publish:', err);
            setError('Failed to update publish status');
        } finally {
            setIsPublishing(null);
        }
    };

    const handleDeleteWorkstream = async (id) => {
        if (!window.confirm('Are you sure you want to delete this workstream and all its content? This action cannot be undone.')) {
            return;
        }

        setIsDeleting(id);
        try {
            await axios.delete(`${API_URL}/workstreams/${id}`);
            fetchWorkstreams();
        } catch (err) {
            setError('Failed to delete workstream');
            console.error('Error deleting workstream:', err);
        } finally {
            setIsDeleting(null);
        }
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
        <div className="admin-modules-container">
            <AdminSidebar />
            <main className="admin-modules-main-content">
                <div className="workstream-overview-page">
                    <div className="admin-modules-header">
                        <div className="header-left">
                            <h1>Workstream Management</h1>
                            <div className="search-container">
                                <input 
                                    type="text" 
                                    placeholder="Search workstreams..." 
                                    className="form-control search-input"
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                                <FaSearch className="search-icon" />
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
                        </div>
                        <div className="header-right">
                            <div className="filter-info">
                                {filteredWorkstreams.length} of {workstreams.length} workstreams
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
                        <div className="admin-modules-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Workstream Name</th>
                                        <th>Description</th>
                                        <th>Chapters</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredWorkstreams.map(ws => (
                                        <tr key={ws.workstream_id}>
                                            <td className="workstream-title">{ws.title}</td>
                                            <td className="workstream-description">
                                                {ws.description?.length > 100 
                                                    ? `${ws.description.substring(0, 100)}...` 
                                                    : ws.description
                                                }
                                            </td>
                                            <td className="chapters-count">
                                                {ws.chapters?.length || 0}
                                            </td>
                                            <td>
                                                <span className={`status-badge ${ws.is_published ? 'published' : 'unpublished'}`}>
                                                    {ws.is_published ? 'Published' : 'Unpublished'}
                                                </span>
                                            </td>
                                            <td className="actions-cell">
                                                <button 
                                                    className="btn-icon" 
                                                    onClick={() => navigate(`/admin/workstream/${ws.workstream_id}/edit`)} 
                                                    title="Manage/Edit Workstream"
                                                >
                                                    <FaCog />
                                                </button>
                                                <button 
                                                    className="btn-icon" 
                                                    onClick={() => handleTogglePublish(ws)} 
                                                    title={ws.is_published ? 'Unpublish' : 'Publish'}
                                                    disabled={isPublishing === ws.workstream_id}
                                                >
                                                    {isPublishing === ws.workstream_id ? (
                                                        <div className="spinner-small"></div>
                                                    ) : (
                                                        ws.is_published ? <FaEyeSlash /> : <FaEye />
                                                    )}
                                                </button>
                                                <button 
                                                    className="btn-icon btn-delete" 
                                                    onClick={() => handleDeleteWorkstream(ws.workstream_id)} 
                                                    title="Delete Workstream"
                                                    disabled={isDeleting === ws.workstream_id}
                                                >
                                                    {isDeleting === ws.workstream_id ? (
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
                </div>
            </main>
        </div>
    );
};

export default A_Modules;
