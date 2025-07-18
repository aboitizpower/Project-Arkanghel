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
      // Editing existing question
      const q = questions[editIndex];
      setModalType(q.question_type || (q.options && q.options.length === 0 ? 'identification' : (q.options && q.options.length === 2 && q.options[0] === 'True' && q.options[1] === 'False' ? 'truefalse' : 'multiple')));
      setModalQuestion(q.question_text || q.question || '');
      setModalOptions(q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : (q.question_type === 'truefalse' ? ['True', 'False'] : ['', '', '', '']));
      setModalCorrectAnswer(q.question_type === 'identification' ? (q.correct_answer ?? q.answer ?? q.correctAnswer ?? '') : (q.correct_answer ?? 0));
      setModalEditIndex(editIndex);
    } else {
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
    let newQuestion;
    if (modalType === 'multiple') {
      const filteredOptions = modalOptions.filter(opt => opt.trim() !== '');
      if (filteredOptions.length < 2) return; // At least 2 options
      let correctAnswerIndex = modalCorrectAnswer;
      if (correctAnswerIndex === '' || correctAnswerIndex === undefined || isNaN(Number(correctAnswerIndex)) || Number(correctAnswerIndex) < 0 || Number(correctAnswerIndex) >= filteredOptions.length) {
        correctAnswerIndex = 0;
      }
      newQuestion = {
        id: modalEditIndex !== null ? questions[modalEditIndex].id || questions[modalEditIndex].question_id : Date.now(),
        question: modalQuestion,
        options: filteredOptions,
        correct_answer: correctAnswerIndex,
        question_type: 'multiple',
      };
    } else if (modalType === 'truefalse') {
      let correctAnswerTF = modalCorrectAnswer;
      if (correctAnswerTF === '' || correctAnswerTF === undefined) {
        correctAnswerTF = 'true';
      }
      newQuestion = {
        id: modalEditIndex !== null ? questions[modalEditIndex].id || questions[modalEditIndex].question_id : Date.now(),
        question: modalQuestion,
        options: ['True', 'False'],
        correct_answer: correctAnswerTF === true || correctAnswerTF === 'true' ? 0 : 1,
        question_type: 'truefalse',
      };
    } else {
      if (!modalCorrectAnswer || !modalCorrectAnswer.trim()) return; // Require answer
      newQuestion = {
        id: modalEditIndex !== null ? questions[modalEditIndex].id || questions[modalEditIndex].question_id : Date.now(),
        question: modalQuestion,
        options: [],
        correct_answer: modalCorrectAnswer,
        question_type: 'identification',
      };
    }
    if (modalEditIndex !== null) {
      // Edit existing
      setQuestions(qs => qs.map((q, i) => i === modalEditIndex ? { ...q, ...newQuestion } : q));
    } else {
      setQuestions(qs => [...qs, newQuestion]);
    }
    setShowModal(false);
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
    const fetchQuestions = async () => {
      try {
        const res = await axios.get(`${API_URL}/assessments/${assessment.assessment_id}/questions`);
        // Ensure correct_answer is properly converted to number for comparison
        const processedQuestions = (res.data || []).map(q => ({
          ...q,
          correct_answer: typeof q.correct_answer === 'string' ? parseInt(q.correct_answer) : q.correct_answer
        }));
        setQuestions(processedQuestions);
      } catch (err) {
        // Optionally set error
      }
    };
    fetchQuestions();
  }, [assessment.assessment_id]);

  const handleSaveDescription = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await axios.put(`${API_URL}/assessments/${assessment.assessment_id}`, {
        ...assessment,
        description: editedDescription
      });
      if (onUpdated) onUpdated();
      setIsEditingDescription(false);
    } catch (err) {
      setError('Failed to update description');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveChapter = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      // In save logic, set is_final = selectedChapterId === 'final', chapter_id = selectedChapterId !== 'final' ? selectedChapterId : null, and title = autoTitle.
      const assessmentData = {
        ...assessment,
        chapter_id: selectedChapterId !== 'final' ? selectedChapterId : null,
        is_final: selectedChapterId === 'final',
        title: autoTitle,
        workstream_id: workstream?.workstream_id || assessment.workstream_id // Always include workstream_id
      };
      await axios.put(`${API_URL}/assessments/${assessment.assessment_id}`, assessmentData);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError('Failed to update chapter assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditQuestion = (qid) => {
    setEditingQuestionId(qid);
    const q = questions.find(q => q.question_id === qid);
    setQuestionEdits({
      question: q.question,
      options: [...(q.options || [])],
      correct_answer: q.correct_answer
    });
  };

  const handleCancelEditQuestion = () => {
    setEditingQuestionId(null);
    setQuestionEdits({});
  };

  const handleQuestionEditChange = (field, value) => {
    setQuestionEdits(edits => ({ ...edits, [field]: value }));
  };

  const handleOptionEditChange = (idx, value) => {
    setQuestionEdits(edits => ({
      ...edits,
      options: edits.options.map((opt, i) => (i === idx ? value : opt))
    }));
  };

  // Overhauled question CRUD logic
  const handleSaveAllQuestions = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      for (const q of questions) {
        const payload = {
          question_text: q.question_text || q.question,
          options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : [],
          correct_answer: q.correct_answer,
          question_type: q.question_type || (q.options && q.options.length === 0 ? 'identification' : (q.options && q.options.length === 2 && q.options[0] === 'True' && q.options[1] === 'False' ? 'truefalse' : 'multiple')),
        };
        if (q.question_id) {
          await axios.put(`${API_URL}/questions/${q.question_id}`, payload);
        } else {
          await axios.post(`${API_URL}/questions`, {
            ...payload,
            assessment_id: assessment.assessment_id
          });
        }
      }
      // Re-fetch questions to sync UI
      const res = await axios.get(`${API_URL}/assessments/${assessment.assessment_id}/questions`);
      setQuestions(res.data || []);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError('Failed to save questions: ' + (err?.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveQuestion = async (qid) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const q = questions.find(q => q.question_id === qid);
      if (!q) return;
      const payload = {
        question_text: q.question_text || q.question,
        options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : [],
        correct_answer: q.correct_answer,
        question_type: q.question_type || (q.options && q.options.length === 0 ? 'identification' : (q.options && q.options.length === 2 && q.options[0] === 'True' && q.options[1] === 'False' ? 'truefalse' : 'multiple')),
      };
      await axios.put(`${API_URL}/questions/${qid}`, payload);
      // Re-fetch questions to sync UI
      const res = await axios.get(`${API_URL}/assessments/${assessment.assessment_id}/questions`);
      setQuestions(res.data || []);
      setEditingQuestionId(null);
      setQuestionEdits({});
      if (onUpdated) onUpdated();
    } catch (err) {
      setError('Failed to update question: ' + (err?.response?.data?.error || err.message));
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
            <button className="btn-primary" onClick={handleSaveAllQuestions} disabled={isSubmitting}>
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
              <label htmlFor="chapter-select">Select Chapter or Final Assessment</label>
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
                  <button className="btn-save btn-primary" onClick={handleSaveDescription} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </button>
                  <button className="btn-cancel btn-secondary" onClick={() => setIsEditingDescription(false)}>Cancel</button>
                </div>
              </>
            ) : (
              <p style={{whiteSpace: 'pre-line'}}>{editedDescription || 'No description'}</p>
            )}
          </div>

          {/* Chapter Dropdown Card */}
          <div className="edit-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: 15 }}>Select Chapter</span>
            </div>
            {isLoadingWorkstream ? (
              <p>Loading chapters...</p>
            ) : workstream && workstream.chapters && workstream.chapters.length > 0 ? (
              <>
                <select
                  id="assessment-chapter"
                  value={selectedChapterId}
                  onChange={(e) => setSelectedChapterId(e.target.value)}
                  className="form-control"
                >
                  <option value="">Select a chapter</option>
                  <option value="final">Final Assessment</option>
                  {workstream.chapters
                    .filter(chapter =>
                      !usedChapterIds.includes(chapter.chapter_id) || chapter.chapter_id === assessment.chapter_id
                    )
                    .map(chapter => (
                      <option key={chapter.chapter_id} value={chapter.chapter_id}>
                        {chapter.title}
                      </option>
                    ))}
                </select>
                <div className="form-actions" style={{ marginTop: 16 }}>
                  <button className="btn-save btn-primary" onClick={handleSaveChapter} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Chapter'}
                  </button>
                  <button className="btn-cancel btn-secondary" onClick={() => setSelectedChapterId(assessment.is_final ? 'final' : (assessment.chapter_id || ''))}>Cancel</button>
                </div>
              </>
            ) : (
              <p>No chapters found for this workstream.</p>
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
              {questions && questions.length > 0 ? questions.map((question, qIndex) => (
                <div key={question.question_id || question.id} className="question-item" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 32 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div className="question-header">
                      <span className="question-number">Question {qIndex + 1}</span>
                      <button type="button" className="remove-question" onClick={() => handleDeleteQuestion(question.question_id || question.id)}>
                        Remove
                      </button>
                      <button type="button" className="edit-inline-btn" style={{ marginLeft: 8, color: '#2563eb' }} onClick={() => openModal(qIndex)}>
                        <FaPencilAlt style={{ fontSize: 13 }} /> Edit
                      </button>
                    </div>
                    <textarea
                      value={question.question_text || question.question || ''}
                      onChange={e => {
                        const updated = [...questions];
                        updated[qIndex] = { ...question, question_text: e.target.value };
                        setQuestions(updated);
                      }}
                      className="form-control"
                      placeholder="Enter your question"
                      rows={4}
                      style={{ resize: 'vertical' }}
                      required
                    />
    </div>
                  {/* Identification type: answer input on the right */}
                  {(question.question_type !== 'multiple' && question.question_type !== 'truefalse') ? (
                    <div
                      className="answer-option"
                      style={{
                        background: question.correct_answer ?? question.answer ?? question.correctAnswer ? '#e0f2fe' : undefined,
                        border: question.correct_answer ?? question.answer ?? question.correctAnswer ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 4,
                        padding: '4px 8px',
                        position: 'relative',
                        minWidth: 220,
                        justifyContent: 'center',
                      }}
                    >
                      <input
                        type="text"
                        value={question.correct_answer ?? question.answer ?? question.correctAnswer ?? ''}
                        onChange={e => {
                          const updated = [...questions];
                          updated[qIndex] = { ...question, correct_answer: e.target.value };
                          setQuestions(updated);
                        }}
                        className="form-control"
                        placeholder="Answer"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          flex: 1,
                          fontSize: '1em',
                        }}
                      />
                      {(question.correct_answer ?? question.answer ?? question.correctAnswer) && (
                        <span
                          style={{
                            color: '#3b82f6',
                            fontWeight: 700,
                            marginLeft: 8,
                            position: 'absolute',
                            right: 12,
                            fontSize: '1.2em',
                          }}
                        >
                          &#10003;
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ flex: 1 }}>
      <div className="answer-options">
                        {(question.options ? (typeof question.options === 'string' ? JSON.parse(question.options) : question.options) : []).map((option, oIndex) => (
                          <div key={oIndex} className="answer-option" style={{
                            background: parseInt(question.correct_answer) === oIndex ? '#e0f2fe' : 'transparent',
                            border: parseInt(question.correct_answer) === oIndex ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 4,
                            padding: '4px 8px'
                          }}>
            <input
              type="radio"
                              name={`question-${question.question_id || question.id}`}
                              checked={parseInt(question.correct_answer) === oIndex}
                              onChange={() => {
                                const updated = [...questions];
                                updated[qIndex] = { ...question, correct_answer: parseInt(oIndex) };
                                setQuestions(updated);
                              }}
                              style={{ accentColor: '#3b82f6' }}
            />
            <input
              type="text"
              value={option}
                              onChange={e => {
                                const updated = [...questions];
                                const currentOptions = question.options ? (typeof question.options === 'string' ? JSON.parse(question.options) : question.options) : [];
                                const newOptions = [...currentOptions];
                                newOptions[oIndex] = e.target.value;
                                updated[qIndex] = { ...question, options: JSON.stringify(newOptions) };
                                setQuestions(updated);
                              }}
              className="form-control"
                              placeholder={`Option ${oIndex + 1}`}
                              required
            />
                            {parseInt(question.correct_answer) === oIndex && (
                              <span style={{ color: '#3b82f6', fontWeight: 700, marginLeft: 4 }}>&#10003;</span>
                            )}
                            {(question.options ? (typeof question.options === 'string' ? JSON.parse(question.options) : question.options) : []).length > 2 && (
              <button 
                type="button" 
                className="remove-answer"
                                onClick={() => {
                                  const updated = [...questions];
                                  const currentOptions = question.options ? (typeof question.options === 'string' ? JSON.parse(question.options) : question.options) : [];
                                  const newOptions = currentOptions.filter((_, idx) => idx !== oIndex);
                                  let newCorrect = parseInt(question.correct_answer);
                                  if (newCorrect >= newOptions.length) newCorrect = newOptions.length - 1;
                                  if (newCorrect < 0) newCorrect = 0;
                                  updated[qIndex] = { ...question, options: JSON.stringify(newOptions), correct_answer: newCorrect };
                                  setQuestions(updated);
                                }}
              >
                ×
              </button>
            )}
                            {/* Add Option button beside last option if less than 4 */}
                            {oIndex === (question.options ? (typeof question.options === 'string' ? JSON.parse(question.options) : question.options) : []).length - 1 && 
                             (question.options ? (typeof question.options === 'string' ? JSON.parse(question.options) : question.options) : []).length < 4 && 
                             question.question_type === 'multiple' &&
                             JSON.stringify((question.options ? (typeof question.options === 'string' ? JSON.parse(question.options) : question.options) : [])) !== JSON.stringify(['True','False']) && (
                              <button 
                                type="button" 
                                className="add-answer"
                                onClick={() => {
                                  const updated = [...questions];
                                  const currentOptions = question.options ? (typeof question.options === 'string' ? JSON.parse(question.options) : question.options) : [];
                                  const newOptions = [...currentOptions, ''];
                                  updated[qIndex] = { ...question, options: JSON.stringify(newOptions) };
                                  setQuestions(updated);
                                }}
                              >
                                + Add Option
                              </button>
                            )}
          </div>
        ))}
                      </div>
                    </div>
                  )}
                </div>
              )) : <p>No questions yet.</p>}
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
