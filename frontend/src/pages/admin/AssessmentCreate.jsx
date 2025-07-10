// File: components/AssessmentCreate.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '../../components/AdminSidebar';
import axios from 'axios';
import '../../styles/admin/AssessmentCreate.css';

const API_URL = 'http://localhost:8081';

const AssessmentCreate = ({ workstream, onCancel, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const addQuestion = () => {
    const newQuestion = {
      id: Date.now(),
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0
    };
    setQuestions([...questions, newQuestion]);
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
    if (!title) {
      setError('Title is required.');
      return;
    }
    if (questions.length === 0) {
      setError('At least one question is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const assessmentData = {
        title,
        description,
        questions: questions.map(q => ({
          question: q.question,
          options: q.options.filter(opt => opt.trim() !== ''),
          correct_answer: q.correctAnswer
        }))
      };

      await axios.post(`${API_URL}/workstreams/${workstream.workstream_id}/assessments`, assessmentData);
      if (onCreated) onCreated();
      else navigate('/admin/modules');
    } catch (err) {
      setError('Failed to create assessment');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="assessment-create-container">
      <AdminSidebar />
      <main className="assessment-create-main-content">
        <div className="assessment-create-header">
          <button className="back-button" onClick={onCancel || (() => navigate('/admin/modules'))}>
            &larr; Back
          </button>
        </div>
        <div className="assessment-create-page">
          <h2>Create New Assessment</h2>
          <p className="subtitle">Fill out the details below to add a new assessment.</p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="assessment-create-form">
            <div className="form-group">
              <label htmlFor="assessment-title">Assessment Title</label>
              <input
                id="assessment-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="form-control"
                placeholder="Enter assessment title"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="assessment-description">Assessment Description</label>
              <textarea
                id="assessment-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-control"
                rows="4"
                placeholder="Enter assessment description"
              />
            </div>

            <div className="questions-section">
              <h3>Questions</h3>
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
                  
                  <input
                    type="text"
                    value={question.question}
                    onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                    className="form-control"
                    placeholder="Enter your question"
                    required
                  />

                  <div className="answer-options">
                    {question.options.map((option, oIndex) => (
                      <div key={oIndex} className="answer-option">
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          checked={question.correctAnswer === oIndex}
                          onChange={() => updateQuestion(question.id, 'correctAnswer', oIndex)}
                        />
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => updateOption(question.id, oIndex, e.target.value)}
                          className="form-control"
                          placeholder={`Option ${oIndex + 1}`}
                          required
                        />
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
                    <button 
                      type="button" 
                      className="add-answer"
                      onClick={() => addOption(question.id)}
                    >
                      + Add Option
                    </button>
                  </div>
                </div>
              ))}
              
              <button type="button" className="add-question" onClick={addQuestion}>
                + Add Question
              </button>
            </div>

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
      </main>
    </div>
  );
};

export default AssessmentCreate;
