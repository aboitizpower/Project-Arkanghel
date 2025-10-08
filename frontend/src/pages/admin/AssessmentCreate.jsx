// File: components/AssessmentCreate.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import AdminSidebar from '../../components/AdminSidebar';
import axios from 'axios';
import '../../styles/admin/AssessmentCreate.css';
import LoadingOverlay from '../../components/LoadingOverlay';
import NotificationDialog from '../../components/NotificationDialog';
import { useAuth } from '../../auth/AuthProvider';

const API_URL = 'http://localhost:8081';

const AssessmentCreate = ({ workstream: propWorkstream, onCancel, onCreated }) => {
  const { workstreamId } = useParams();
  const { user } = useAuth();
  if (!workstreamId) {
    return (
      <div style={{ padding: '2rem', color: 'red', textAlign: 'center' }}>
        <h2>Error: No workstream ID provided in the URL.</h2>
        <p>Cannot create assessment. Please return to Workstream Management and select a workstream.</p>
      </div>
    );
  }
  const location = useLocation();
  const stateWorkstream = location.state?.workstream;
  const [workstream, setWorkstream] = useState(propWorkstream || stateWorkstream);
  const [isLoading, setIsLoading] = useState(!propWorkstream && !stateWorkstream);
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: 'success', isVisible: false });
  const navigate = useNavigate();
  const [usedChapterIds, setUsedChapterIds] = useState([]);
  const [hasFinalAssessment, setHasFinalAssessment] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('multiple');
  const [modalQuestion, setModalQuestion] = useState('');
  const [modalOptions, setModalOptions] = useState(['', '', '', '']);
  const [modalCorrectAnswer, setModalCorrectAnswer] = useState('');
  const [deadline, setDeadline] = useState('');

  // Fetch workstream data if not provided as prop
  useEffect(() => {
    if (!workstreamId && !(propWorkstream || stateWorkstream)) return;
    const fetchData = async () => {
      try {
        const targetWorkstreamId = propWorkstream?.workstream_id || stateWorkstream?.workstream_id || workstreamId;
        console.log('AssessmentCreate - Fetching data for workstream ID:', targetWorkstreamId);
        const [workstreamRes, assessmentsRes] = await Promise.all([
          axios.get(`${API_URL}/workstreams/${targetWorkstreamId}/complete`, {
            headers: { 'Authorization': `Bearer ${user?.token}` }
          }),
          axios.get(`${API_URL}/workstreams/${targetWorkstreamId}/assessments`, {
            headers: { 'Authorization': `Bearer ${user?.token}` }
          })
        ]);
        console.log('AssessmentCreate - Workstream response:', workstreamRes.data);
        console.log('AssessmentCreate - Assessments response:', assessmentsRes.data);
        setWorkstream(workstreamRes.data);
        const assessments = assessmentsRes.data || [];
        console.log('AssessmentCreate - Processed assessments:', assessments);
        const used = assessments.filter(a => a.chapter_id).map(a => a.chapter_id);
        setUsedChapterIds(used);
        setHasFinalAssessment(assessments.some(a => a.is_final));
        setIsLoading(false);
      } catch (err) {
        console.error('AssessmentCreate - Error loading workstream data:', err);
        console.error('AssessmentCreate - Error response:', err.response?.data);
        console.error('AssessmentCreate - Error status:', err.response?.status);
        setError('Failed to load workstream data. Please check your connection or try again.');
        setIsLoading(false);
      }
    };
    fetchData();
  }, [propWorkstream, stateWorkstream, workstreamId]);

  // Handle correct answer initialization when modal type changes
  useEffect(() => {
    if (modalType === 'truefalse') {
      setModalCorrectAnswer(true); // Always default to true for True/False
    } else if (modalType === 'multiple') {
      setModalCorrectAnswer(0); // First option for Multiple Choice
    } else if (modalType === 'identification') {
      setModalCorrectAnswer(''); // Empty string for Identification
    }
  }, [modalType]);

  const openModal = () => {
    setShowModal(true);
    setModalType('multiple');
    setModalQuestion('');
    setModalOptions(['', '', '', '']);
    setModalCorrectAnswer(0); // Default for multiple choice (first option)
  };
  const closeModal = () => {
    setShowModal(false);
  };
  const handleModalOptionChange = (idx, value) => {
    setModalOptions(opts => opts.map((opt, i) => (i === idx ? value : opt)));
  };
  const handleAddModalOption = () => {
    setModalOptions(opts => [...opts, '']);
  };
  const handleRemoveModalOption = (idx) => {
    setModalOptions(opts => opts.filter((_, i) => i !== idx));
    setModalCorrectAnswer(ans => Math.max(0, Math.min(ans, modalOptions.length - 2)));
  };
  const handleModalSubmit = () => {
    if (!modalQuestion.trim()) return;
    let newQuestion;
    if (modalType === 'multiple') {
      // Default to Option 1 (index 0) if no selection made
      const filteredOptions = modalOptions.filter(opt => opt.trim() !== '');
      let correctAnswerIndex = modalCorrectAnswer;
      if (correctAnswerIndex === '' || correctAnswerIndex === undefined || isNaN(Number(correctAnswerIndex)) || Number(correctAnswerIndex) < 0 || Number(correctAnswerIndex) >= filteredOptions.length) {
        correctAnswerIndex = 0;
      }
      newQuestion = {
        id: Date.now(),
        question: modalQuestion,
        options: filteredOptions,
        correctAnswer: correctAnswerIndex,
        type: 'multiple'
      };
    } else if (modalType === 'truefalse') {
      // Simple True/False handling - ensure correctAnswer is always a string
      const correctAnswerValue = modalCorrectAnswer === true ? 'True' : 'False';
      
      newQuestion = {
        id: Date.now(),
        question: modalQuestion,
        options: ['True', 'False'],
        correctAnswer: correctAnswerValue, // This should be "True" or "False" string
        type: 'truefalse'
      };
      
      console.log('Created True/False question:', newQuestion);
    } else if (modalType === 'identification') {
      newQuestion = {
        id: Date.now(),
        question: modalQuestion,
        options: [], // Ensure options array exists for consistency
        correctAnswer: modalCorrectAnswer,
        type: 'identification'
      };
    }
    setQuestions(qs => [...qs, newQuestion]);
    closeModal();
  };

  const removeQuestion = (questionId) => {
    setQuestions(questions.filter(q => q.id !== questionId));
  };

  const updateQuestion = (questionId, field, value) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, [field]: value } : q
    ));
  };

  const updateOption = (questionId, optionIndex, value) => {
    setQuestions(questions.map(q => 
      q.id === questionId 
        ? { 
            ...q, 
            options: q.options.map((opt, idx) => 
              idx === optionIndex ? value : opt
            )
          }
        : q
    ));
  };

  const addOption = (questionId) => {
    setQuestions(questions.map(q => 
      q.id === questionId 
        ? { ...q, options: [...q.options, ''] }
        : q
    ));
  };

  const removeOption = (questionId, optionIndex) => {
    setQuestions(questions.map(q => 
      q.id === questionId 
        ? { 
            ...q, 
            options: q.options.filter((_, idx) => idx !== optionIndex),
            correctAnswer: Math.min(q.correctAnswer, q.options.length - 2)
          }
        : q
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if user is authenticated
    if (!user || !user.token) {
      setError('You must be logged in to create an assessment.');
      return;
    }
    
    if (!selectedChapterId) {
      setError('Please select a chapter or final assessment.');
      return;
    }
    if (questions.length === 0) {
      setError('At least one question is required.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      let generatedTitle = '';
      let chapterIdToSend = null;
      let isFinalToSend = false;

      if (selectedChapterId === 'final') {
        generatedTitle = `Final Assessment for: ${workstream?.title || ''}`;
        isFinalToSend = true;
        // For final assessments, we need to create a final assessment chapter first
        // or use the last chapter as the final assessment chapter
        const lastChapter = workstream?.chapters?.[workstream.chapters.length - 1];
        chapterIdToSend = lastChapter ? lastChapter.chapter_id : null;
      } else {
        const chapter = workstream?.chapters?.find(ch => ch.chapter_id == selectedChapterId);
        generatedTitle = chapter ? `Assessment: ${chapter.title}` : '';
        chapterIdToSend = selectedChapterId ? Number(selectedChapterId) : null;
      }

      const assessmentData = {
        title: generatedTitle,
        description: `Assessment for ${workstream?.title || ''}`,
        questions: questions.map(q => {
          console.log('Frontend sending question:', {
            question: q.question?.substring(0, 50) + '...',
            type: q.type,
            correctAnswer: q.correctAnswer,
            options: q.options
          });
          return {
            question: q.question,
            type: q.type, // Keep original type values: 'multiple', 'truefalse', 'identification'
            correctAnswer: q.type === 'truefalse' ? String(q.correctAnswer) : q.correctAnswer, // Ensure True/False answers are strings
            options: q.options || null
          };
        }),
        chapterId: chapterIdToSend,
        is_final: isFinalToSend,
        deadline: deadline || null
      };
      
      console.log('Complete assessment data being sent:', assessmentData);
      const targetWorkstreamId = workstream?.workstream_id || workstreamId;
      await axios.post(`${API_URL}/workstreams/${targetWorkstreamId}/assessments`, assessmentData, {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        }
      });
      
      setNotification({
        message: 'Assessment created successfully!',
        type: 'success',
        isVisible: true
      });
      
      if (onCreated) {
        onCreated();
      } else {
        setTimeout(() => {
          navigate(`/admin/workstream/${targetWorkstreamId}/edit`);
        }, 1500);
      }
    } catch (err) {
      let backendMsg = err?.response?.data?.error || err?.message || 'Failed to create assessment';
      setError('Failed to create assessment: ' + backendMsg);
      setNotification({
        message: 'Failed to create assessment. Please try again.',
        type: 'error',
        isVisible: true
      });
      console.error('Assessment creation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    setShowModal(false);
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="assessment-create-container">
        <AdminSidebar />
        <main className="assessment-create-main-content">
          <LoadingOverlay loading={isLoading} />
          <div className="loading-message">Loading workstream data...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="assessment-create-container">
        <AdminSidebar />
        <main className="assessment-create-main-content">
          <LoadingOverlay loading={isLoading} />
          <div className="error-message">{error}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="assessment-create-container">
      <AdminSidebar />
      <main className="assessment-create-main-content">
        <LoadingOverlay loading={isLoading} />
        <div className="assessment-create-header">
          <button className="back-button" onClick={onCancel || (() => navigate('/admin/modules'))}>
            &larr; Back
          </button>
        </div>
        <div className="assessment-create-row" style={{ display: 'flex', height: 'calc(100vh - 48px)', minHeight: 0 }}>
          {/* Left box: Assessment details form */}
          <div className="assessment-create-page assessment-create-left" style={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', borderRadius: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)', background: '#fff' }}>
            <h2>Create New Assessment</h2>
            <p className="subtitle">Select a chapter or choose Final Assessment. The name will be auto-generated.</p>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit} className="assessment-create-form">
              {/* Chapter dropdown */}
              {workstream?.chapters && workstream.chapters.length > 0 && (
                <div className="form-group">
                  <label htmlFor="chapter-select">Select Chapter or Final Assessment</label>
                  <select
                    id="chapter-select"
                    className="form-control"
                    value={selectedChapterId || ''}
                    onChange={e => setSelectedChapterId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select a chapter or final assessment</option>
                    {workstream.chapters.map(ch => (
                      <option
                        key={ch.chapter_id}
                        value={ch.chapter_id}
                        disabled={usedChapterIds.includes(ch.chapter_id)}
                      >
                        {ch.title}{usedChapterIds.includes(ch.chapter_id) ? ' (Already has assessment)' : ''}
                      </option>
                    ))}
                    <option value="final" disabled={hasFinalAssessment}>
                      Final Assessment{hasFinalAssessment ? ' (Already exists)' : ''}
                    </option>
                  </select>
                </div>
              )}
              {/* Auto-generated assessment name (read-only) */}
              <div className="form-group">
                <label>Assessment Name (auto-generated)</label>
                <input
                  type="text"
                  className="form-control"
                  value={selectedChapterId === 'final'
                    ? `Final Assessment for: ${workstream?.title || ''}`
                    : (selectedChapterId
                        ? `Assessment: ${workstream?.chapters?.find(ch => ch.chapter_id == selectedChapterId)?.title || ''}`
                        : '')}
                  readOnly
                  style={{ background: '#f3f4f6', color: '#222', fontWeight: 600 }}
                />
              </div>
              {/* Optional description */}
              <div className="form-group">
                <label htmlFor="assessment-description">Assessment Description (optional)</label>
                <textarea
                  id="assessment-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-control"
                  rows="4"
                  placeholder="Enter assessment description (optional)"
                />
              </div>
              {/* Optional deadline */}
              <div className="form-group">
                <label htmlFor="assessment-deadline">Assessment Deadline (optional)</label>
                <input
                  type="datetime-local"
                  id="assessment-deadline"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="form-control"
                  placeholder="Select deadline date and time"
                />
                <small className="form-text">Leave empty for no deadline. Students who submit after the deadline will receive a score of 0.</small>
              </div>
              {/* The description field is now supported in the DB and will be sent as part of the payload */}
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Assessment'}
                </button>
                <button type="button" className="btn-secondary" onClick={onCancel || (() => navigate('/admin/modules'))}>
                  Cancel
                </button>
              </div>
            </form>
          </div>

          {/* Right box: Questions section */}
          <div
            className={`assessment-create-page assessment-create-right${questions.length === 0 ? ' empty-questions' : ''}`}
            style={{
              flex: 1,
              minHeight: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box',
              borderRadius: '24px',
              boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
              background: '#fff',
            }}
          >
            <div className="questions-section">
              <h3>Questions</h3>
              <div className="questions-scroll-list">
                {questions.map((question, qIndex) => (
                  <div key={question.id} className="question-item">
                    <div className="question-header">
                      <span className="question-number">Question {qIndex + 1}</span>
                      <button 
                        type="button" 
                        className="remove-question"
                        onClick={() => removeQuestion(question.id)}
                      >
                        Remove
                      </button>
                    </div>
                    
                    <textarea
                      value={question.question}
                      onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                      className="form-control"
                      placeholder="Enter your question"
                      rows={4}
                      style={{ resize: 'vertical' }}
                      required
                    />

                    <div className="answer-options">
                      {question.type === 'identification' ? (
                        <div>
                          <label>Correct Answer</label>
                          <input
                            type="text"
                            value={question.correctAnswer || ''}
                            onChange={(e) => updateQuestion(question.id, 'correctAnswer', e.target.value)}
                            className="form-control"
                            placeholder="Correct Answer"
                          />
                        </div>
                      ) : (
                        <>
                          {question.options.map((option, oIndex) => (
                            <div
                              key={oIndex}
                              className={`answer-option${question.correctAnswer === oIndex ? ' correct-answer' : ''}`}
                              style={
                                question.correctAnswer === oIndex
                                  ? {
                                      background: '#e0f2fe',
                                      border: '2px solid #3b82f6',
                                      borderRadius: 6,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      marginBottom: 4,
                                      padding: '4px 8px',
                                      position: 'relative',
                                    }
                                  : {
                                      border: '1px solid #e5e7eb',
                                      borderRadius: 6,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      marginBottom: 4,
                                      padding: '4px 8px',
                                      position: 'relative',
                                    }
                              }
                            >
                              <input
                                type="radio"
                                name={`question-${question.id}`}
                                checked={question.correctAnswer === oIndex}
                                onChange={() => updateQuestion(question.id, 'correctAnswer', oIndex)}
                                style={{ accentColor: '#3b82f6' }}
                              />
                              <input
                                type="text"
                                value={option}
                                onChange={e => updateOption(question.id, oIndex, e.target.value)}
                                className="form-control"
                                placeholder={`Option ${oIndex + 1}`}
                                required
                              />
                              {question.correctAnswer === oIndex && (
                                <span
                                  style={{
                                    color: '#3b82f6',
                                    fontWeight: 700,
                                    marginLeft: 4,
                                    position: 'absolute',
                                    right: 12,
                                    fontSize: '1.2em',
                                  }}
                                >
                                  &#10003;
                                </span>
                              )}
                              {question.options.length > 2 && (
                                <button
                                  type="button"
                                  className="remove-answer"
                                  onClick={() => removeOption(question.id, oIndex)}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                          {question.type === 'multiple' && question.options.length < 4 && (
                          <button 
                            type="button" 
                            className="add-answer"
                            onClick={() => addOption(question.id)}
                          >
                            + Add Option
                          </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* Modal for adding a question */}
              {showModal && (
                <div className="modal-overlay">
                  <div className="modal-content">
                    <h4>Question {questions.length + 1}</h4>
                    <label>Question Type</label>
                    <select value={modalType} onChange={e => setModalType(e.target.value)} className="form-control">
                      <option value="multiple">Multiple Choice</option>
                      <option value="truefalse">True/False</option>
                      <option value="identification">Identification</option>
                    </select>
                    <label>Question</label>
                    <textarea
                      className="form-control"
                      value={modalQuestion}
                      onChange={e => setModalQuestion(e.target.value)}
                      placeholder="Enter your question"
                      rows={4}
                      style={{ resize: 'vertical' }}
                      required
                    />
                    {modalType === 'multiple' && (
                      <>
                        <label>Options</label>
                        {modalOptions.map((opt, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                            <input
                              type="text"
                              className="form-control"
                              value={opt}
                              onChange={e => handleModalOptionChange(idx, e.target.value)}
                              placeholder={`Option ${idx + 1}`}
                              required
                            />
                            {modalOptions.length > 2 && (
                              <button type="button" onClick={() => handleRemoveModalOption(idx)} style={{ color: 'red', border: 'none', background: 'none' }}>×</button>
                            )}
                            {/* Show Add Option button beside the last option if less than 4 options */}
                            {idx === modalOptions.length - 1 && modalOptions.length < 4 && (
                              <button type="button" className="add-answer" onClick={handleAddModalOption} style={{ marginLeft: 8 }}>
                                + Add Option
                              </button>
                            )}
                          </div>
                        ))}
                        <label>Correct Answer</label>
                        <select value={modalCorrectAnswer} onChange={e => setModalCorrectAnswer(Number(e.target.value))} className="form-control" style={{ width: '100%' }}>
                          {modalOptions.map((opt, idx) => (
                            <option key={idx} value={idx}>{`Option ${idx + 1}`}</option>
                          ))}
                        </select>
                      </>
                    )}
                    {modalType === 'truefalse' && (
                      <>
                        <label>Correct Answer</label>
                        <select value={modalCorrectAnswer === true ? 'true' : 'false'} onChange={e => {
                          setModalCorrectAnswer(e.target.value === 'true');
                        }} className="form-control">
                          <option value="true">True</option>
                          <option value="false">False</option>
                        </select>
                      </>
                    )}
                    {modalType === 'identification' && (
                      <>
                        <label>Correct Answer</label>
                        <input
                          type="text"
                          className="form-control"
                          value={modalCorrectAnswer}
                          onChange={e => setModalCorrectAnswer(e.target.value)}
                          placeholder="Enter the correct answer"
                          required
                        />
                      </>
                    )}
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                      <button type="button" className="btn-primary" onClick={handleModalSubmit}>Add</button>
                    </div>
                  </div>
                </div>
              )}
              <button type="button" className="add-question" onClick={openModal}>
                + Add Question
              </button>
            </div>
          </div>
        </div>
      </main>
      <NotificationDialog
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={() => setNotification({ ...notification, isVisible: false })}
      />
    </div>
  );
};

export default AssessmentCreate;
