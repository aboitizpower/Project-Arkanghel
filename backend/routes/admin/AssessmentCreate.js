import express from 'express';

const router = express.Router();

// Create a new assessment - Used by AssessmentCreate.jsx
router.post('/assessments', (req, res) => {
    const { chapter_id, title, total_points, passing_score } = req.body;
    
    if (!chapter_id || !title || !total_points || !passing_score) {
        return res.status(400).json({ error: 'chapter_id, title, total_points, and passing_score are required.' });
    }
    
    const sql = 'INSERT INTO assessments (chapter_id, title, total_points, passing_score) VALUES (?, ?, ?, ?)';
    req.db.query(sql, [chapter_id, title, total_points, passing_score], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ 
            success: 'Assessment created successfully!', 
            assessment_id: result.insertId 
        });
    });
});

// Create questions for an assessment - Used by AssessmentCreate.jsx
router.post('/assessments/:id/questions', (req, res) => {
    const { id } = req.params;
    const { questions } = req.body;
    
    if (!questions || !Array.isArray(questions)) {
        return res.status(400).json({ error: 'questions array is required.' });
    }
    
    req.db.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ error: 'Failed to start transaction.' });
        }
        
        let completedQuestions = 0;
        const totalQuestions = questions.length;
        
        if (totalQuestions === 0) {
            return req.db.commit(err => {
                if (err) {
                    return req.db.rollback(() => res.status(500).json({ error: 'Failed to commit transaction.' }));
                }
                res.json({ success: 'Assessment questions created successfully!' });
            });
        }
        
        questions.forEach((question, index) => {
            const { question_text, question_type, points, answers } = question;
            
            const questionSql = 'INSERT INTO questions (assessment_id, question_text, question_type, points) VALUES (?, ?, ?, ?)';
            req.db.query(questionSql, [id, question_text, question_type, points], (err, questionResult) => {
                if (err) {
                    return req.db.rollback(() => res.status(500).json({ error: `Failed to create question ${index + 1}: ${err.message}` }));
                }
                
                const questionId = questionResult.insertId;
                
                if (!answers || answers.length === 0) {
                    completedQuestions++;
                    if (completedQuestions === totalQuestions) {
                        req.db.commit(err => {
                            if (err) {
                                return req.db.rollback(() => res.status(500).json({ error: 'Failed to commit transaction.' }));
                            }
                            res.json({ success: 'Assessment questions created successfully!' });
                        });
                    }
                    return;
                }
                
                let completedAnswers = 0;
                const totalAnswers = answers.length;
                
                answers.forEach((answer, answerIndex) => {
                    const { answer_text, is_correct } = answer;
                    const answerSql = 'INSERT INTO answers (question_id, answer_text, is_correct) VALUES (?, ?, ?)';
                    
                    req.db.query(answerSql, [questionId, answer_text, is_correct], (err, answerResult) => {
                        if (err) {
                            return req.db.rollback(() => res.status(500).json({ error: `Failed to create answer ${answerIndex + 1} for question ${index + 1}: ${err.message}` }));
                        }
                        
                        completedAnswers++;
                        if (completedAnswers === totalAnswers) {
                            completedQuestions++;
                            if (completedQuestions === totalQuestions) {
                                req.db.commit(err => {
                                    if (err) {
                                        return req.db.rollback(() => res.status(500).json({ error: 'Failed to commit transaction.' }));
                                    }
                                    res.json({ success: 'Assessment questions created successfully!' });
                                });
                            }
                        }
                    });
                });
            });
        });
    });
});

export default router;
