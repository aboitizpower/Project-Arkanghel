import React, { useState } from 'react';
import '../styles/FeedbackModal.css';
import { Bug, Lightbulb } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

const FeedbackModal = ({ closeModal, showNotification }) => {
  const { user } = useAuth();
  const [view, setView] = useState('selection'); // 'selection', 'bug', 'suggestion'
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const handleSubmit = async () => {
    const subject = view === 'bug' ? 'Bug Report' : 'Suggestion';
    if (!feedbackText || isSubmitting || !user) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:8081/employee/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          subject: subject,
          message: feedbackText,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Backend submission error:', response.status, errorBody);
        throw new Error(`Failed to submit feedback. Status: ${response.status}`);
      }

      setSubmitted(true);
      showNotification();
      closeModal();

    } catch (error) {
      console.error('Feedback submission error:', error);
      setIsSubmitting(false); // Reset on error
      // Optionally, show an error message to the user
    }
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <>
            <button className="close-button" onClick={closeModal}>&times;</button>
            {view !== 'selection' && <button className="back-button" onClick={() => setView('selection')}>&larr; Back</button>}
            
            {view === 'selection' ? (
              <>
                <h2>Feedback</h2>
                <div className="feedback-options">
                  <button className="feedback-option" onClick={() => setView('bug')}>
                    <Bug className="feedback-icon" color="#254EDB" />
                    <div className="feedback-text">
                      <h3>Report a bug</h3>
                      <p>Something is broken? Let us know!</p>
                    </div>
                  </button>
                  <button className="feedback-option" onClick={() => setView('suggestion')}>
                    <Lightbulb className="feedback-icon" color="#254EDB" />
                    <div className="feedback-text">
                      <h3>Suggest improvements</h3>
                      <p>What could we do better?</p>
                    </div>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="form-title">
                  {view === 'bug' ? <Bug className="title-icon" /> : <Lightbulb className="title-icon" />}
                  {view === 'bug' ? 'Report a Bug' : 'Suggest an Improvement'}
                </h2>
                <textarea
                  className="feedback-textarea"
                  rows="6"
                  placeholder="Please provide as much detail as possible."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                />
                <div className="modal-actions">
                  <button onClick={handleSubmit} className="btn-submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending...' : 'Send Feedback'}
                  </button>
                </div>
              </>
            )}
          </>
              </div>
    </div>
  );
};

export default FeedbackModal;
