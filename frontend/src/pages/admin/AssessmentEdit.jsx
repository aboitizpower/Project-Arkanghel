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
      if (modalQuestionType === 'multiple') {
        // Parse options if needed
        let options = Array.isArray(question.options) ? question.options :
                     (typeof question.options === 'string' ? JSON.parse(question.options) : []);
        setModalOptions(options.length > 0 ? options : ['', '', '', '']);
        setModalCorrectAnswer(question.correct_answer || 0);
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
      setModalCorrectAnswer('');
      setModalEditIndex(null);
    }
    setShowModal(true);
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

    // Prepare the question data
    const questionData = {
      question_text: modalQuestion.trim(),
      question_type: modalType === 'multiple' ? 'multiple_choice' : 
                    modalType === 'truefalse' ? 'true_false' : 'identification'
    };

    // Handle options and correct answer based on type
    if (modalType === 'multiple') {
      const filteredOptions = modalOptions.filter(opt => opt.trim() !== '');
      if (filteredOptions.length < 2) {
        alert('Multiple choice questions must have at least 2 options.');
        return;
      }
      questionData.options = filteredOptions;
      questionData.correct_answer = parseInt(modalCorrectAnswer, 10) || 0;
    } else if (modalType === 'truefalse') {
      questionData.options = ['True', 'False'];
      questionData.correct_answer = modalCorrectAnswer === 'true' ? 0 : 1;
    } else {
      // Identification questions have no options
      questionData.options = [];
      questionData.correct_answer = modalCorrectAnswer.trim();
      if (!questionData.correct_answer) {
        alert('Please provide an answer for the identification question.');
        return;
      }
    }

    // If we're editing, use the existing question ID
    if (modalEditIndex !== null) {
      const existingQuestion = questions[modalEditIndex];
      const questionId = existingQuestion.question_id || existingQuestion.id;
      
      // Update existing question
      axios.put(`${API_URL}/questions/${questionId}`, questionData)
        .then(() => {
          // Update the questions array with the new data
          setQuestions(prevQuestions => 
            prevQuestions.map((q, idx) => 
              idx === modalEditIndex ? { ...q, ...questionData, question_id: questionId } : q
            )
          );
          setShowModal(false);
        })
        .catch(err => {
          console.error('Error updating question:', err);
          alert('Failed to update question. Please try again.');
        });
    } else {
      // Create new question
      axios.post(`${API_URL}/questions`, {
        ...questionData,
        assessment_id: assessment.assessment_id
      })
        .then(response => {
          setQuestions(prev => [...prev, response.data]);
          setShowModal(false);
        })
        .catch(err => {
          console.error('Error creating question:', err);
          alert('Failed to create question. Please try again.');
        });
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
        if (!workstreamId && assessment.chapter_id) {
          try {
            const chapterRes = await axios.get(`${API_URL}/chapters/${assessment.chapter_id}`);
            workstreamId = chapterRes.data.workstream_id;
          } catch (err) {
            console.error('Failed to get workstream ID from chapter:', err);
          }
        }
        if (workstreamId) {
          const [workstreamRes, assessmentsRes] = await Promise.all([
            axios.get(`${API_URL}/workstreams/${workstreamId}/complete`),
            axios.get(`${API_URL}/workstreams/${workstreamId}/assessments`)
          ]);
          setWorkstream(workstreamRes.data);
          // Build set of used chapter IDs, excluding the current assessment's chapter
          const used = (assessmentsRes.data || [])
            .filter(a => a.assessment_id !== assessment.assessment_id && a.chapter_id)
            .map(a => a.chapter_id);
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
    // Always fetch questions for this assessment on mount
    const fetchAssessmentData = async () => {
      try {
        // Fetch both assessment details and questions
        const [assessmentRes, questionsRes] = await Promise.all([
          axios.get(`${API_URL}/assessments/${assessment.assessment_id}`),
          axios.get(`${API_URL}/assessments/${assessment.assessment_id}/questions`)
        ]);

        // Set description from assessment data
        setEditedDescription(assessmentRes.data.description || '');

        // Process questions
        const processedQuestions = (questionsRes.data || []).map(q => {
          let correctAnswer = q.correct_answer;
          if (q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
            if (typeof correctAnswer === 'string') {
              correctAnswer = parseInt(correctAnswer, 10);
            }
          }
          return {
            ...q,
            correct_answer: correctAnswer
          };
        });
        setQuestions(processedQuestions);

      } catch (err) {
        // Optionally set error
        console.error("Failed to fetch assessment data:", err);
      }
    };
    fetchAssessmentData();
  }, [assessment.assessment_id]);

  // Overhauled question CRUD logic
  const handleSaveAllChanges = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      // 1. Save assessment details (chapter, title, description)
      const assessmentData = {
        ...assessment,
        chapter_id: selectedChapterId !== 'final' ? selectedChapterId : null,
        is_final: selectedChapterId === 'final',
        title: autoTitle,
        description: editedDescription,
        workstream_id: workstream?.workstream_id || assessment.workstream_id
      };
      await axios.put(`${API_URL}/assessments/${assessment.assessment_id}`, assessmentData);

      // 2. Save all questions
      for (const q of questions) {
        console.log('Saving question:', q); // Debug log
        const payload = {
          question_text: q.question_text || q.question,
          options: Array.isArray(q.options) ? q.options : 
                  (typeof q.options === 'string' ? JSON.parse(q.options) : []),
          correct_answer: q.correct_answer,
          question_type: q.question_type === 'multiple' ? 'multiple_choice' :
                        q.question_type === 'truefalse' ? 'true_false' :
                        q.question_type
        };
        console.log('Question payload:', payload); // Debug log
        
        if (q.question_id) {
          await axios.put(`${API_URL}/questions/${q.question_id}`, payload);
        } else {
          await axios.post(`${API_URL}/questions`, {
            ...payload,
            assessment_id: assessment.assessment_id
          });
        }
      }
      
      // 3. Sync UI and close editing states
      setIsEditingDescription(false);
      // Re-fetch questions to sync UI
      const res = await axios.get(`${API_URL}/assessments/${assessment.assessment_id}/questions`);
      console.log('Fetched updated questions:', res.data); // Debug log
      setQuestions(res.data || []);
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Save error:', err); // Debug log
      setError('Failed to save changes: ' + (err?.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await axios.delete(`${API_URL}/questions/${questionId}`);
      // Re-fetch questions to sync UI
      const res = await axios.get(`${API_URL}/assessments/${assessment.assessment_id}/questions`);
      setQuestions(res.data || []);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError('Failed to delete question: ' + (err?.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAssessment = async () => {
    if (!window.confirm('Are you sure you want to delete this assessment and all its questions?')) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await axios.delete(`${API_URL}/assessments/${assessment.assessment_id}`);
      if (onCancel) onCancel();
      else navigate('/admin/assessment');
    } catch (err) {
      setError('Failed to delete assessment');
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
        // Show the actual option text that is correct
        return options && options[question.correct_answer] ? (
          <div className="answer-display">
            {options[question.correct_answer]}
          </div>
        ) : null;

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
            <button
              className="btn-delete-assessment"
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '0.5rem 1.25rem',
                fontWeight: 600,
                fontSize: '1rem',
                boxShadow: '0 2px 8px rgba(239,68,68,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                transition: 'background 0.2s',
              }}
              onClick={handleDeleteAssessment}
              disabled={isSubmitting}
              onMouseOver={e => e.currentTarget.style.background = '#b91c1c'}
              onMouseOut={e => e.currentTarget.style.background = '#ef4444'}
            >
              <FaTrash style={{ marginRight: 8 }} /> Delete Assessment
            </button>
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
              <select
                id="chapter-select"
                className="form-control"
                value={selectedChapterId}
                onChange={e => setSelectedChapterId(e.target.value)}
              >
                <option value="">Select a chapter or final assessment</option>
                {workstream?.chapters?.map(ch => (
                  <option key={ch.chapter_id} value={ch.chapter_id}>{ch.title}</option>
                ))}
                <option value="final">Final Assessment for: {workstream?.title || ''}</option>
              </select>
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
