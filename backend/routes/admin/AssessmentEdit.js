import express from 'express';

const router = express.Router();

// Get a specific assessment for editing - Used by AssessmentEdit.jsx
router.get('/assessments/:id', (req, res) => {
    const { id } = req.params;
    
    const assessmentSql = `
        SELECT 
            a.*,
            mc.title as chapter_title,
            w.title as workstream_title
        FROM assessments a
        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
        JOIN workstreams w ON mc.workstream_id = w.workstream_id
        WHERE a.assessment_id = ?
    `;
    
    req.db.query(assessmentSql, [id], (err, assessmentResults) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (assessmentResults.length === 0) {
            return res.status(404).json({ error: 'Assessment not found.' });
        }
        
        const assessment = assessmentResults[0];
        
        // Get questions and answers
        const questionsSql = `
            SELECT 
                q.question_id,
                q.question_text,
                q.question_type,
                q.points,
                a.answer_id,
                a.answer_text,
                a.is_correct
            FROM questions q
            LEFT JOIN answers a ON q.question_id = a.question_id
            WHERE q.assessment_id = ?
            ORDER BY q.question_id, a.answer_id
        `;
        
        req.db.query(questionsSql, [id], (err, questionResults) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Group answers by question
            const questionsMap = {};
            questionResults.forEach(row => {
                if (!questionsMap[row.question_id]) {
                    questionsMap[row.question_id] = {
                        question_id: row.question_id,
                        question_text: row.question_text,
                        question_type: row.question_type,
                        points: row.points,
                        answers: []
                    };
                }
                
                if (row.answer_id) {
                    questionsMap[row.question_id].answers.push({
                        answer_id: row.answer_id,
                        answer_text: row.answer_text,
                        is_correct: row.is_correct
                    });
                }
            });
            
            assessment.questions = Object.values(questionsMap);
            res.json(assessment);
        });
    });
});

// Update an assessment - Used by AssessmentEdit.jsx
router.put('/assessments/:id', (req, res) => {
    const { id } = req.params;
    const { title, total_points, passing_score } = req.body;
    
    if (!title || !total_points || !passing_score) {
        return res.status(400).json({ error: 'title, total_points, and passing_score are required.' });
    }
    
    const sql = 'UPDATE assessments SET title = ?, total_points = ?, passing_score = ? WHERE assessment_id = ?';
    req.db.query(sql, [title, total_points, passing_score, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Assessment not found.' });
        }
        res.json({ success: 'Assessment updated successfully!' });
    });
});

// Delete an assessment - Used by AssessmentEdit.jsx
router.delete('/assessments/:id', (req, res) => {
    const { id } = req.params;
    
    req.db.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ error: 'Failed to start transaction.' });
        }
        
        // First delete all answers for questions in this assessment
        const deleteAnswersSql = `
            DELETE a FROM answers a
            JOIN questions q ON a.question_id = q.question_id
            WHERE q.assessment_id = ?
        `;
        
        req.db.query(deleteAnswersSql, [id], (err, result) => {
            if (err) {
                return req.db.rollback(() => res.status(500).json({ error: 'Failed to delete answers.' }));
            }
            
            // Then delete all questions for this assessment
            const deleteQuestionsSql = 'DELETE FROM questions WHERE assessment_id = ?';
            req.db.query(deleteQuestionsSql, [id], (err, result) => {
                if (err) {
                    return req.db.rollback(() => res.status(500).json({ error: 'Failed to delete questions.' }));
                }
                
                // Finally delete the assessment
                const deleteAssessmentSql = 'DELETE FROM assessments WHERE assessment_id = ?';
                req.db.query(deleteAssessmentSql, [id], (err, result) => {
                    if (err) {
                        return req.db.rollback(() => res.status(500).json({ error: 'Failed to delete assessment.' }));
                    }
                    
                    req.db.commit(err => {
                        if (err) {
                            return req.db.rollback(() => res.status(500).json({ error: 'Failed to commit transaction.' }));
                        }
                        res.json({ success: 'Assessment deleted successfully!' });
                    });
                });
            });
        });
    });
});

export default router;
