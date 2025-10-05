import React, { useState } from 'react';
import EmployeeSidebar from '../../components/EmployeeSidebar';
import '../../styles/employee/Feedback.css';
import { useAuth } from '../../auth/AuthProvider';

const E_Feedback = () => {
    const { user } = useAuth();
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setSuccess(false);

        try {
            const response = await fetch('/employee/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: user.id, subject, message }),
            });

            if (!response.ok) {
                throw new Error('Failed to submit feedback');
            }

            setSuccess(true);
            setSubject('');
            setMessage('');
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="e-feedback-container">
            <EmployeeSidebar />
            <main className="e-feedback-main">
                <h1>Submit Feedback</h1>
                <form onSubmit={handleSubmit} className="feedback-form">
                    <div className="form-group">
                        <label htmlFor="subject">Subject</label>
                        <input
                            type="text"
                            id="subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="message">Message</label>
                        <textarea
                            id="message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            required
                        ></textarea>
                    </div>
                    <button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                    {error && <p className="error-message">{error}</p>}
                    {success && <p className="success-message">Feedback submitted successfully!</p>}
                </form>
            </main>
        </div>
    );
};

export default E_Feedback;
