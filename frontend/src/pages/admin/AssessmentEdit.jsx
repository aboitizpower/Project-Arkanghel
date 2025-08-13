// File: components/AssessmentEdit.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminSidebar from '../../components/AdminSidebar';
import axios from 'axios';
import { FaPencilAlt, FaTrash, FaSave, FaTimes } from 'react-icons/fa';
import '../../styles/admin/AssessmentEdit.css';
import LoadingOverlay from '../../components/LoadingOverlay';

const API_URL = 'http://localhost:8081';

const AssessmentEdit = ({ assessment, onCancel, onUpdated }) => {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(assessment.description || '');
  // Remove manual title editing state and UI
  // Add state for final assessment toggle
  // Remove isFinal state and logic
  // Use only selectedChapterId, where 'final' means final assessment
  const [selectedChapterId, setSelectedChapterId] = useState(
    assessment.is_final ? 'final' : (assessment.chapter_id || '')
  );
  const [questions, setQuestions] = useState(assessment.questions || []);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [questionEdits, setQuestionEdits] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [workstream, setWorkstream] = useState(null);
  const [isLoadingWorkstream, setIsLoadingWorkstream] = useState(true);
  const navigate = useNavigate();
  const [usedChapterIds, setUsedChapterIds] = useState([]);
  const [hasFinalAssessment, setHasFinalAssessment] = useState(false);

  // Add Question Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('multiple');
  const [modalQuestion, setModalQuestion] = useState('');
  const [modalOptions, setModalOptions] = useState(['', '', '', '']);
  const [modalCorrectAnswer, setModalCorrectAnswer] = useState('');
  const [modalEditIndex, setModalEditIndex] = useState(null); // Track which question is being edited

  const openModal = (editIndex = null) => {
    if (editIndex !== null) {
      const question = questions[editIndex];
      
      // Set question type
      let modalQuestionType;
      switch (question.question_type) {
        case 'multiple_choice':
          modalQuestionType = 'multiple';
          break;
        case 'true_false':
          modalQuestionType = 'truefalse';
          break;
        default:
          modalQuestionType = 'identification';
      }
      
      setModalType(modalQuestionType);
      setModalQuestion(question.question_text);
      
      // Handle options and correct answer based on type
      if (question.question_type === 'multiple_choice' && question.options) {
        const options = Array.isArray(question.options) ? question.options : JSON.parse(question.options);
        // The correct_answer is an index for multiple_choice
        const answerIndex = parseInt(question.correct_answer, 10);
        if (options && !isNaN(answerIndex) && options[answerIndex] !== undefined) {
          setModalCorrectAnswer(answerIndex);
        } else {
          setModalCorrectAnswer(0); // Default to the first option if not found
        }
        setModalOptions(options.length > 0 ? options : ['', '', '', '']);
      } else if (modalQuestionType === 'truefalse') {
        setModalOptions(['True', 'False']);
        setModalCorrectAnswer(question.correct_answer === 0 ? 'true' : 'false');
      } else {
        // For identification questions
        setModalOptions([]); // No options needed
        setModalCorrectAnswer(question.correct_answer || ''); // Use the answer text directly
      }
      
      setModalEditIndex(editIndex);
    } else {
      // New question defaults
      setModalType('multiple');
      setModalQuestion('');
      setModalOptions(['', '', '', '']);
      setModalCorrectAnswer(0); // Default to Option 1 (index 0)
      setModalEditIndex(null);
    }
    setShowModal(true);
  };
  const closeModal = () => {
    setShowModal(false);
  };
  const handleModalOptionChange = (idx, value) => {
    setModalOptions(currentOptions => 
      currentOptions.map((opt, i) => (i === idx ? value : opt))
    );
  };
  const handleAddModalOption = () => {
    setModalOptions(opts => [...opts, '']);
  };
  const handleRemoveModalOption = (idx) => {
    setModalOptions(opts => opts.filter((_, i) => i !== idx));
    setModalCorrectAnswer(ans => Math.max(0, Math.min(ans, modalOptions.length - 2)));
  };
  const handleModalSubmit = async () => {
    if (!modalQuestion.trim()) return;

    let finalCorrectAnswer = modalCorrectAnswer;

    if (modalType === 'truefalse') {
      finalCorrectAnswer = modalCorrectAnswer ? 'True' : 'False';
    } else if (modalType === 'multiple') {
      // For multiple choice, the index is stored directly.
      finalCorrectAnswer = modalCorrectAnswer;
    }

    const questionPayload = {
      question_text: modalQuestion,
      question_type: modalType === 'multiple' ? 'multiple_choice' : (modalType === 'truefalse' ? 'true_false' : 'identification'),
      options: modalType === 'multiple' ? modalOptions.filter(opt => opt.trim()) : [],
      correct_answer: finalCorrectAnswer,
      assessment_id: assessment.assessment_id
    };

    setIsSubmitting(true);
    try {
      if (modalEditIndex !== null && questions[modalEditIndex]?.question_id) {
        const questionId = questions[modalEditIndex].question_id;
        await axios.put(`${API_URL}/questions/${questionId}`, questionPayload);
      } else {
        await axios.post(`${API_URL}/questions`, questionPayload);
      }
      
      const response = await axios.get(`${API_URL}/assessments/${assessment.assessment_id}`);
      setQuestions(response.data.questions || []);
      closeModal();
    } catch (err) {
      setError('Failed to save question: ' + (err?.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const location = useLocation();
  useEffect(() => {
    setShowModal(false);
  }, [location.pathname]);

  // Fetch workstream data to get chapters and used chapters
  useEffect(() => {
    const fetchWorkstream = async () => {
      try {
        let workstreamId = assessment.workstream_id;
        // If workstreamId is not directly available, try to get it from the chapter
        if (!workstreamId && assessment.chapter_id) {
          try {
            const chapterRes = await axios.get(`${API_URL}/chapters/${assessment.chapter_id}`);
            workstreamId = chapterRes.data.workstream_id;
          } catch (err) {
            console.error('Failed to get workstream ID from chapter:', err);
          }
        }

        if (workstreamId) {
          // Fetch the complete workstream data, which includes chapters and their assessments
          const response = await axios.get(`${API_URL}/workstreams/${workstreamId}/complete`);
          const workstreamData = response.data;
          setWorkstream(workstreamData);

          // Check if there's already a final assessment
          const finalAssessmentExists = workstreamData.assessments?.some(
            a => a.is_final && a.assessment_id !== assessment.assessment_id
          );
          setHasFinalAssessment(finalAssessmentExists);

          // Determine which chapters already have assessments
          const used = (workstreamData.chapters || [])
            .filter(ch => ch.assessments && ch.assessments.length > 0 && ch.id !== assessment.chapter_id)
            .map(ch => ch.id);
          setUsedChapterIds(used);
        }
      } catch (err) {
        console.error('Failed to fetch workstream data:', err);
        setError('Failed to fetch workstream data.');
      } finally {
        setIsLoadingWorkstream(false);
      }
    };
    fetchWorkstream();
  }, [assessment]);

  useEffect(() => {
    const fetchAssessmentData = async () => {
      // Ensure we have a valid assessment ID before fetching
      if (assessment && assessment.assessment_id) {
        try {
          const response = await axios.get(`${API_URL}/assessments/${assessment.assessment_id}`);
          const data = response.data;
          // Set all relevant state from the fetched data
          setEditedDescription(data.description || '');
          setQuestions(data.questions || []);
        } catch (err) {
          setError('Failed to fetch assessment data.');
          console.error('Error fetching assessment data:', err);
        }
      }
    };
    fetchAssessmentData();
  }, [assessment.assessment_id]); // Depend only on the ID

    const handleSaveAllChanges = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const is_final = selectedChapterId === 'final';
      const payload = {
        title: autoTitle, // Use the auto-generated title
        description: editedDescription,
        is_final: is_final,
        // Send chapter_id only if it's not a final assessment
        chapter_id: is_final ? null : selectedChapterId,
        // Ensure workstream_id is included for the backend logic
        workstream_id: workstream?.workstream_id
      };

      await axios.put(`${API_URL}/assessments/${assessment.assessment_id}`, payload);
      
      if (onUpdated) {
        onUpdated(); // Callback to refresh the parent component's data
      }
      setIsEditingDescription(false);

    } catch (err) {
      setError('Failed to save changes: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-generate title based on dropdown selection
  const autoTitle = selectedChapterId === 'final'
    ? `Final Assessment for: ${workstream?.title || ''}`
    : (selectedChapterId
        ? `Assessment: ${workstream?.chapters?.find(ch => ch.chapter_id == selectedChapterId)?.title || ''}`
        : assessment.title);

  const renderQuestionAnswer = (question) => {
    if (!question) return null;

    // Parse options if they're stored as a string
    let options = question.options;
    if (typeof options === 'string') {
      try {
        options = JSON.parse(options);
      } catch (e) {
        options = [];
      }
    }

    switch (question.question_type) {
      case 'multiple_choice':
        const answerIndex = parseInt(question.correct_answer, 10);
        if (options && Array.isArray(options) && !isNaN(answerIndex) && options[answerIndex] !== undefined) {
          return (
            <div className="answer-display">
              {options[answerIndex]}
            </div>
          );
        }
        return (
            <div className="answer-display text-danger">
              Invalid Answer
            </div>
        );

      case 'true_false':
        // Show True or False based on the 0/1 index
        return (
          <div className="answer-display">
            {question.correct_answer === 0 ? 'True' : 'False'}
          </div>
        );

      case 'identification':
      case 'short_answer':
        // Show the actual text answer
        return (
          <div className="answer-display">
            {question.correct_answer}
          </div>
        );

      default:
        return null;
    }
  };

  const renderQuestionDisplay = (question, index) => {
    return (
      <div key={question.question_id || question.id} className="question-item">
        <div className="question-header">
          <h3>Question {index + 1}</h3>
          <div className="question-actions">
            <button onClick={() => openModal(index)} className="edit-btn">
              <FaPencilAlt /> Edit
            </button>
            <button onClick={() => handleDeleteQuestion(question.question_id || question.id)} className="remove-btn">
              Remove
            </button>
          </div>
        </div>
        <div className="question-content">
          <p className="question-text">{question.question_text}</p>
          <div className="question-type">
            <span className="type-label">Type:</span>
            <span className="type-value">
              {question.question_type === 'multiple_choice' ? 'Multiple Choice' :
               question.question_type === 'true_false' ? 'True/False' : 'Identification'}
            </span>
          </div>
          <div className="answer-section">
            <span className="answer-label">Correct Answer:</span>
            <span className="answer-value">
              {renderQuestionAnswer(question)}
            </span>
          </div>
          {question.question_type === 'multiple_choice' && Array.isArray(question.options) && (
            <div className="options-section">
              <span className="options-label">Options:</span>
              <ul className="options-list">
                {question.options.map((opt, i) => (
                  <li key={i} className={i === question.correct_answer ? 'correct' : ''}>
                    {opt}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="assessment-create-main-content">
      <LoadingOverlay loading={isSubmitting} />
      <div className="assessment-create-header" style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <button className="back-button" onClick={onCancel || (() => navigate('/admin/modules'))}>
            &larr; Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', gap: 16 }}>
            <button className="btn-primary" onClick={handleSaveAllChanges} disabled={isSubmitting}>
              <FaSave style={{ marginRight: 6 }} /> Save All Changes
            </button>
          </div>
        </div>
      <div className="assessment-create-row">
        {/* Left box: Assessment details form as cards */}
        <div className="assessment-details-left" style={{ minWidth: 420, maxWidth: 700, width: '100%' }}>
          {/* Title Card */}
          <div className="edit-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: 15 }}>Assessment Structure</span>
            </div>
            <div className="form-group">
              <label>Select Chapter or Final Assessment</label>
              <div style={{ position: 'relative' }}>
                <select
                  id="chapter-select"
                  className="form-control"
                  value={selectedChapterId}
                  onChange={e => setSelectedChapterId(e.target.value)}
                  disabled={hasFinalAssessment && selectedChapterId !== 'final'}
                  title={hasFinalAssessment && selectedChapterId !== 'final' ? "Cannot change chapter selection because a Final Assessment already exists" : ""}
                  style={hasFinalAssessment && selectedChapterId !== 'final' ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {}}
                >
                <option value="">Select a chapter or final assessment</option>
                {workstream?.chapters?.map(ch => (
                  <option key={ch.chapter_id} value={ch.chapter_id}>{ch.title}</option>
                ))}
                  <option value="final">Final Assessment for: {workstream?.title || ''}</option>
                </select>
                {hasFinalAssessment && selectedChapterId !== 'final' && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#f8f9fa',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #dee2e6',
                    marginTop: '4px',
                    fontSize: '0.85rem',
                    color: '#6c757d',
                    zIndex: 10
                  }}>
                    Cannot change chapter selection because a Final Assessment already exists
                  </div>
                )}
              </div>
            </div>
            <div className="form-group">
              <label>Assessment Name</label>
              <input
                type="text"
                className="form-control"
                value={autoTitle}
                readOnly
                style={{ background: '#f3f4f6', color: '#222', fontWeight: 600 }}
              />
            </div>
          </div>

          {/* Description Card */}
          <div className="edit-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: 15 }}>Description</span>
              {!isEditingDescription && (
                <button
                  type="button"
                  className="edit-inline-btn"
                  onClick={() => setIsEditingDescription(true)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
                >
                  <FaPencilAlt style={{ fontSize: 13 }} /> Edit description
                </button>
              )}
            </div>
            {isEditingDescription ? (
              <>
                <textarea
                  id="assessment-description"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  className="form-control"
                  rows={4}
                  placeholder="Edit assessment description"
                />
                <div className="form-actions">
                  <button className="btn-cancel btn-secondary" onClick={() => setIsEditingDescription(false)}>Cancel</button>
                </div>
              </>
            ) : (
              <p style={{whiteSpace: 'pre-line'}}>{editedDescription || 'No description'}</p>
            )}
          </div>
        </div>

        {/* Right box: Questions section */}
        <div
          className={`assessment-create-page assessment-create-right${questions.length === 0 ? ' empty-questions' : ''}`}
          style={{
            height: '80vh',
            maxHeight: '80vh',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Panel Title */}
          <div style={{ flex: '0 0 auto' }}>
            <h2 style={{ margin: '8px 0 16px 0', fontWeight: 700, fontSize: '1.15rem' }}>Questions</h2>
          </div>
          {/* Scrollable Questions List */}
          <div className="questions-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <div className="questions-scroll-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
              {questions && questions.length > 0 ? questions.map((question, qIndex) => renderQuestionDisplay(question, qIndex)) : <p>No questions yet.</p>}
            </div>
            {/* Modal for adding a question */}
            {showModal && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <h4>{modalEditIndex !== null ? `Edit Question ${modalEditIndex + 1}` : `Question ${questions.length + 1}`}</h4>
                  <label>Question Type</label>
                  <select value={modalType} onChange={e => setModalType(e.target.value)} className="form-control" disabled={modalEditIndex !== null}>
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
                      <select value={modalCorrectAnswer} onChange={e => setModalCorrectAnswer(e.target.value === 'true' ? true : false)} className="form-control">
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
                    <button type="button" className="btn-primary" onClick={handleModalSubmit}>{modalEditIndex !== null ? 'Save' : 'Add'}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Add Question Button at the bottom, not scrollable */}
          <div style={{ flex: '0 0 auto', marginTop: '1rem', display: 'flex', justifyContent: 'flex-start' }}>
            <button className="add-question-btn" onClick={() => openModal()}>
              + Add Question
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AssessmentEdit;
