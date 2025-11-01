import React, { useState } from 'react';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import NotificationDialog from '../../components/NotificationDialog';
import '../../styles/employee/Feedback.css';
import { useAuth } from '../../auth/AuthProvider';
import API_URL from '../../config/api';

const E_Feedback = () => {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`${API_URL}/employee/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({ userId: user.id, subject, message }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setSuccess(true);
      setSubject('');
      setMessage('');
      setShowNotification(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="feedback-container">
      <EmployeeSidebar />
      <div className="feedback-content">
        <h1>Feedback</h1>
        <p>We would love to hear your thoughts, suggestions, concerns, or problems with anything so we can improve!</p>
        <form className="feedback-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="subject">Subject</label>
            <input 
              type="text" 
              id="subject" 
              name="subject" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required 
            />
          </div>
          <div className="form-group">
            <label htmlFor="message">Message</label>
            <textarea 
              id="message" 
              name="message" 
              rows="8" 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            ></textarea>
          </div>
          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
          {error && <p className="error-message">{error}</p>}
          {success && <p className="success-message">Feedback submitted successfully!</p>}
        </form>
        <NotificationDialog
          message="Thank you for your feedback"
          type="success"
          isVisible={showNotification}
          onClose={() => setShowNotification(false)}
          duration={3000}
        />
      </div>
    </div>
  );
};

export default E_Feedback;
