import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaCalendarAlt, FaCheckCircle, FaClock, FaTimes } from 'react-icons/fa';
import '../styles/components/TaskSidebar.css';

const API_URL = 'http://localhost:8081';

const TaskSidebar = () => {
  const [todos, setTodos] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const userId = localStorage.getItem('userId');

  useEffect(() => {
    if (userId) {
      fetchTaskData();
    }
  }, [userId]);

  const fetchTaskData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/employee/tasks/${userId}`);
      setTodos(response.data.todos || []);
      setUpcomingTasks(response.data.upcomingTasks || []);
      setRecentFeedback(response.data.recentFeedback || []);
    } catch (error) {
      console.error('Error fetching task data:', error);
      // Set sample data for development
      setSampleData();
    } finally {
      setLoading(false);
    }
  };

  const setSampleData = () => {
    setTodos([
      {
        id: 1,
        title: 'Turn in Group Assignment',
        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        completed: false,
        type: 'assignment'
      },
      {
        id: 2,
        title: 'Turn in Video Assignment',
        dueDate: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
        completed: false,
        type: 'assignment'
      }
    ]);

    setUpcomingTasks([
      {
        id: 3,
        title: 'Group Assignment',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        type: 'assignment'
      },
      {
        id: 4,
        title: 'Unit 2 Discussion',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
        type: 'discussion'
      },
      {
        id: 5,
        title: 'Midterm Assignment',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        type: 'assignment'
      },
      {
        id: 6,
        title: 'Video Assignment',
        dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
        type: 'assignment'
      }
    ]);

    setRecentFeedback([
      {
        id: 7,
        title: 'Pass/Fail',
        status: 'Complete',
        type: 'feedback'
      },
      {
        id: 8,
        title: 'Croc O Group Assignment',
        score: '10 out of 10',
        type: 'feedback'
      }
    ]);
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

  if (loading) {
    return (
      <div className="task-sidebar">
        <div className="task-sidebar-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="task-sidebar">
      {/* Due Today Section */}
      <div className="task-section">
        <h3 className="task-section-title">Due Today</h3>
        <div className="task-list">
          {todos && todos.length > 0 ? (
            todos.filter(todo => !todo.completed).map(todo => (
              <div key={todo.id} className="task-item todo-item">
                <div className="task-item-content">
                  <button 
                    className="task-checkbox"
                    onClick={() => markTodoComplete(todo.id)}
                  >
                    <FaCheckCircle className="checkbox-icon" />
                  </button>
                  <div className="task-details">
                    <span className="task-title">{todo.title || 'Untitled Task'}</span>
                    <span className="task-due-date">{formatDueDate(todo.dueDate)}</span>
                  </div>
                </div>
                <button 
                  className="task-remove"
                  onClick={() => removeTodo(todo.id)}
                >
                  <FaTimes />
                </button>
              </div>
            ))
          ) : (
            <div className="no-tasks">No pending tasks</div>
          )}
        </div>
      </div>

      {/* Coming Up Section */}
      <div className="task-section">
        <h3 className="task-section-title">Coming Up</h3>
        <div className="task-list">
          {upcomingTasks && upcomingTasks.length > 0 ? (
            upcomingTasks.map(task => (
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
      </div>

      {/* Task Completed / Done Section*/}
      <div className="task-section">
        <h3 className="task-section-title">Completed</h3>
        <div className="task-list">
          {recentFeedback && recentFeedback.length > 0 ? (
            recentFeedback.map(feedback => (
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
      </div>
    </div>
  );
};

export default TaskSidebar;
