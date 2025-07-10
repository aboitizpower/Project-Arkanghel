// File: components/AssessmentEdit.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '../../components/AdminSidebar';
import axios from 'axios';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import '../../styles/admin/AssessmentEdit.css';

const API_URL = 'http://localhost:8081';

const AssessmentEdit = ({ assessment, onCancel, onUpdated }) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(assessment.title);

  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(assessment.description || '');

  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSaveTitle = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await axios.put(`${API_URL}/assessments/${assessment.assessment_id}`, {
        ...assessment,
        title: editedTitle
      });
      if (onUpdated) onUpdated();
      setIsEditingTitle(false);
    } catch (err) {
      setError('Failed to update title');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateQuestion = async (questionId, updatedQuestion) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await axios.put(`${API_URL}/assessments/${assessment.assessment_id}/questions/${questionId}`, updatedQuestion);
      if (onUpdated) onUpdated();
      setSelectedQuestion(null);
    } catch (err) {
      setError('Failed to update question');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await axios.delete(`${API_URL}/assessments/${assessment.assessment_id}/questions/${questionId}`);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError('Failed to delete question');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="assessment-edit-container">
      <AdminSidebar />
      <main className="assessment-edit-main-content">
        <div className="assessment-edit-header">
          <button className="back-button" onClick={onCancel || (() => navigate('/admin/modules'))}>
            &larr; Back
          </button>
        </div>
        <div className="assessment-edit-page">
          <h2>Edit Assessment</h2>

          <div className="assessment-edit-content">
            <div className="assessment-details-left">
              <div className="edit-card">
                <h4>Title</h4>
                {isEditingTitle ? (
                  <>
                    <input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="form-control"
                    />
                    <div className="edit-actions">
                      <button className="btn-save" onClick={handleSaveTitle} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save'}
                      </button>
                      <button className="btn-cancel" onClick={() => setIsEditingTitle(false)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>{assessment.title}</p>
                    <button onClick={() => setIsEditingTitle(true)}>Edit</button>
                  </>
                )}
              </div>

              <div className="edit-card">
                <h4>Description</h4>
                {isEditingDescription ? (
                  <>
                    <textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      className="form-control"
                    />
                    <div className="edit-actions">
                      <button className="btn-save" onClick={handleSaveDescription} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save'}
                      </button>
                      <button className="btn-cancel" onClick={() => setIsEditingDescription(false)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>{assessment.description || 'No description'}</p>
                    <button onClick={() => setIsEditingDescription(true)}>Edit</button>
                  </>
                )}
              </div>

              <div className="questions-list-container">
                <div className="questions-header">
                  <h3>Questions</h3>
                </div>
                <div className="questions-list">
                  {assessment.questions && assessment.questions.map((question, index) => (
                    <div key={question.question_id} className="question-item">
                      <p className="question-text">{question.question}</p>
                      <div className="question-actions">
                        <button 
                          className="btn-icon btn-edit"
                          onClick={() => setSelectedQuestion(question)}
                        >
                          <FaPencilAlt />
                        </button>
                        <button 
                          className="btn-icon btn-delete"
                          onClick={() => handleDeleteQuestion(question.question_id)}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selectedQuestion && (
              <div className="question-detail">
                <h4>Edit Question</h4>
                <QuestionEditor 
                  question={selectedQuestion}
                  onSave={handleUpdateQuestion}
                  onCancel={() => setSelectedQuestion(null)}
                  isSubmitting={isSubmitting}
                />
              </div>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>
      </main>
    </div>
  );
};

const QuestionEditor = ({ question, onSave, onCancel, isSubmitting }) => {
  const [editedQuestion, setEditedQuestion] = useState(question.question);
  const [editedOptions, setEditedOptions] = useState(question.options || []);
  const [correctAnswer, setCorrectAnswer] = useState(question.correct_answer || 0);

  const addOption = () => {
    setEditedOptions([...editedOptions, '']);
  };

  const removeOption = (index) => {
    const newOptions = editedOptions.filter((_, i) => i !== index);
    setEditedOptions(newOptions);
    if (correctAnswer >= index) {
      setCorrectAnswer(Math.max(0, correctAnswer - 1));
    }
  };

  const updateOption = (index, value) => {
    const newOptions = [...editedOptions];
    newOptions[index] = value;
    setEditedOptions(newOptions);
  };

  const handleSave = () => {
    onSave(question.question_id, {
      question: editedQuestion,
      options: editedOptions.filter(opt => opt.trim() !== ''),
      correct_answer: correctAnswer
    });
  };

  return (
    <div>
      <div className="form-group">
        <label>Question</label>
        <input
          type="text"
          value={editedQuestion}
          onChange={(e) => setEditedQuestion(e.target.value)}
          className="form-control"
        />
      </div>

      <div className="answer-options">
        <label>Options</label>
        {editedOptions.map((option, index) => (
          <div key={index} className={`answer-option ${correctAnswer === index ? 'correct-answer' : ''}`}>
            <input
              type="radio"
              name="correct-answer"
              checked={correctAnswer === index}
              onChange={() => setCorrectAnswer(index)}
            />
            <input
              type="text"
              value={option}
              onChange={(e) => updateOption(index, e.target.value)}
              className="form-control"
              placeholder={`Option ${index + 1}`}
            />
            {editedOptions.length > 2 && (
              <button 
                type="button" 
                className="remove-answer"
                onClick={() => removeOption(index)}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button type="button" className="add-answer" onClick={addOption}>
          + Add Option
        </button>
      </div>

      <div className="edit-actions">
        <button className="btn-save" onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
        <button className="btn-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};

export default AssessmentEdit;
