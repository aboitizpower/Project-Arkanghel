import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { FaCalendarAlt, FaCheckCircle, FaClock, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { useAuth } from '../auth/AuthProvider';
import '../styles/components/TaskSidebar.css';

const API_URL = 'http://localhost:8081';

const TaskSidebar = () => {
  const [todos, setTodos] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('comingUp');
  const [currentPage, setCurrentPage] = useState({ comingUp: 1, missed: 1, completed: 1 });
  const [itemsPerPage] = useState(8);
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (user?.id) {
      fetchTaskData();
    } else {
      // If no user, just stop loading and show empty state
      setLoading(false);
    }
  }, [user]);

  const fetchTaskData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/employee/tasks/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      // Set the actual data from API, empty arrays if no data
      setTodos(response.data.todos || []);
      setUpcomingTasks(response.data.upcomingTasks || []);
      setRecentFeedback(response.data.recentFeedback || []);
    } catch (error) {
      console.error('Error fetching task data:', error);
      // Set empty arrays on error
      setTodos([]);
      setUpcomingTasks([]);
      setRecentFeedback([]);
    } finally {
      setLoading(false);
    }
  };


  const markTodoComplete = async (todoId) => {
    try {
      await axios.put(`${API_URL}/employee/tasks/${todoId}/complete`);
      setTodos(todos.map(todo => 
        todo.id === todoId ? { ...todo, completed: true } : todo
      ));
    } catch (error) {
      console.error('Error marking todo complete:', error);
      // For development, just update locally
      setTodos(todos.map(todo => 
        todo.id === todoId ? { ...todo, completed: true } : todo
      ));
    }
  };

  const removeTodo = (todoId) => {
    setTodos(todos.filter(todo => todo.id !== todoId));
  };

  const formatDueDate = (date) => {
    try {
      if (!date) return 'No due date';
      
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return 'Invalid date';
      
      const now = new Date();
      const diffTime = dateObj.getTime() - now.getTime();
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffHours < 24) {
        return `due today at ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (diffDays === 1) {
        return 'due tomorrow';
      } else if (diffDays <= 7) {
        return `due in ${diffDays} days`;
      } else {
        return `due ${dateObj.toLocaleDateString()}`;
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const getMissedTasks = () => {
    // Filter todos for tasks that are overdue (past due date and not completed)
    return todos.filter(todo => {
      if (todo.completed) return false;
      const dueDate = new Date(todo.dueDate);
      const now = new Date();
      return dueDate < now;
    });
  };

  const getPaginatedItems = (items, tabName) => {
    const startIndex = (currentPage[tabName] - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  };

  const getTotalPages = (items) => {
    return Math.ceil(items.length / itemsPerPage);
  };

  const handlePageChange = (tabName, direction) => {
    setCurrentPage(prev => ({
      ...prev,
      [tabName]: direction === 'next' 
        ? Math.min(prev[tabName] + 1, getTotalPages(getItemsForTab(tabName)))
        : Math.max(prev[tabName] - 1, 1)
    }));
  };

  const getItemsForTab = (tabName) => {
    switch (tabName) {
      case 'comingUp': return upcomingTasks || [];
      case 'missed': return getMissedTasks();
      case 'completed': return recentFeedback || [];
      default: return [];
    }
  };

  const renderPaginationControls = (tabName) => {
    const items = getItemsForTab(tabName);
    const totalPages = getTotalPages(items);
    
    if (totalPages <= 1) return null;

    return (
      <div className="task-pagination">
        <button 
          className="pagination-btn"
          onClick={() => handlePageChange(tabName, 'prev')}
          disabled={currentPage[tabName] === 1}
        >
          ‹
        </button>
        <span className="pagination-info">
          {currentPage[tabName]} / {totalPages}
        </span>
        <button 
          className="pagination-btn"
          onClick={() => handlePageChange(tabName, 'next')}
          disabled={currentPage[tabName] === totalPages}
        >
          ›
        </button>
      </div>
    );
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="tab-content-loading">
          <div className="loading-spinner"></div>
          <p>Loading tasks...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'comingUp':
        const paginatedUpcoming = getPaginatedItems(upcomingTasks || [], 'comingUp');
        return (
          <div className="task-list-container">
            <div className="task-list">
              {upcomingTasks && upcomingTasks.length > 0 ? (
                paginatedUpcoming.map(task => (
                  <div key={task.id} className="task-item upcoming-item">
                    <div className="task-item-content">
                      <div className="task-icon">
                        <FaClock />
                      </div>
                      <div className="task-details">
                        <span className="task-title">{task.title || 'Untitled Task'}</span>
                        <span className="task-due-date">{formatDueDate(task.dueDate)}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-tasks">No upcoming tasks</div>
              )}
            </div>
            {renderPaginationControls('comingUp')}
          </div>
        );
      case 'missed':
        const missedTasks = getMissedTasks();
        const paginatedMissed = getPaginatedItems(missedTasks, 'missed');
        return (
          <div className="task-list-container">
            <div className="task-list">
              {missedTasks && missedTasks.length > 0 ? (
                paginatedMissed.map(task => (
                  <div key={task.id} className="task-item missed-item">
                    <div className="task-item-content">
                      <div className="task-icon missed-icon">
                        <FaExclamationTriangle />
                      </div>
                      <div className="task-details">
                        <span className="task-title">{task.title || 'Untitled Task'}</span>
                        <span className="task-due-date missed-date">{formatDueDate(task.dueDate)}</span>
                      </div>
                    </div>
                    <button 
                      className="task-remove"
                      onClick={() => removeTodo(task.id)}
                    >
                      <FaTimes />
                    </button>
                  </div>
                ))
              ) : (
                <div className="no-tasks">No missed tasks</div>
              )}
            </div>
            {renderPaginationControls('missed')}
          </div>
        );
      case 'completed':
        const paginatedCompleted = getPaginatedItems(recentFeedback || [], 'completed');
        return (
          <div className="task-list-container">
            <div className="task-list">
              {recentFeedback && recentFeedback.length > 0 ? (
                paginatedCompleted.map(feedback => (
                  <div key={feedback.id} className="task-item feedback-item">
                    <div className="task-item-content">
                      <div className="task-icon feedback-icon">
                        <FaCheckCircle />
                      </div>
                      <div className="task-details">
                        <span className="task-title">{feedback.title || 'Untitled Feedback'}</span>
                        <span className="task-status">
                          {feedback.status || feedback.score || 'No status'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-tasks">No recent feedback</div>
              )}
            </div>
            {renderPaginationControls('completed')}
          </div>
        );
      default:
        return <div className="no-tasks">Select a tab to view tasks</div>;
    }
  };

  return (
    <div className="task-sidebar">
      {/* Tab Navigation */}
      <div className="sidebar-tab-navigation">
        <button 
          className={`sidebar-tab-button ${activeTab === 'comingUp' ? 'active' : ''}`}
          onClick={() => setActiveTab('comingUp')}
        >
          <FaClock className="tab-icon" />
          <span className="tab-text">Coming Up</span>
          {upcomingTasks && upcomingTasks.length > 0 && (
            <span className="tab-badge">{upcomingTasks.length}</span>
          )}
        </button>
        <button 
          className={`sidebar-tab-button ${activeTab === 'missed' ? 'active' : ''}`}
          onClick={() => setActiveTab('missed')}
        >
          <FaExclamationTriangle className="tab-icon" />
          <span className="tab-text">Missed</span>
          {(() => {
            const missedTasks = getMissedTasks();
            return missedTasks && missedTasks.length > 0 && (
              <span className="tab-badge">{missedTasks.length}</span>
            );
          })()}
        </button>
        <button 
          className={`sidebar-tab-button ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          <FaCheckCircle className="tab-icon" />
          <span className="tab-text">Completed</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="sidebar-tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default TaskSidebar;
