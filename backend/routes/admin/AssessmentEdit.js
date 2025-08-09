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
        
        // Get questions and their options
        const questionsSql = `
            SELECT 
                question_id,
                question_text,
                question_type,
                correct_answer,
                options
            FROM questions
            WHERE assessment_id = ?
            ORDER BY question_id
        `;

        req.db.query(questionsSql, [id], (err, questionResults) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            assessment.questions = questionResults.map(q => ({
                ...q,
                // Ensure options are parsed, default to empty array if null/invalid
                options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options || []
            }));

            res.json(assessment);
        });
    });
});

// Update an assessment - Used by AssessmentEdit.jsx
router.put('/assessments/:id', (req, res) => {
    const { id } = req.params;
    const { description, chapter_id } = req.body;

    if (description === undefined || chapter_id === undefined) {
        return res.status(400).json({ error: 'description and chapter_id are required.' });
    }

    const finalChapterId = chapter_id === 'final' ? null : chapter_id;

    if (finalChapterId === null) {
        // This is a final assessment
        const sql = 'UPDATE assessments SET title = ?, description = ?, chapter_id = ? WHERE assessment_id = ?';
        const params = ['Final Assessment', description, null, id];
        req.db.query(sql, params, (err, result) => {
            if (err) {
                console.error('Failed to update assessment:', err);
                return res.status(500).json({ error: 'Failed to update assessment.', details: err.message });
            }
            res.json({ success: 'Assessment updated successfully!' });
        });
    } else {
        // This is a chapter-specific assessment
        req.db.query('SELECT title FROM module_chapters WHERE chapter_id = ?', [finalChapterId], (err, chapters) => {
            if (err || chapters.length === 0) {
                return res.status(404).json({ error: 'Chapter not found.' });
            }
            const chapterTitle = chapters[0].title;
            const assessmentTitle = `Assessment: ${chapterTitle}`;

            const sql = 'UPDATE assessments SET title = ?, description = ?, chapter_id = ? WHERE assessment_id = ?';
            const params = [assessmentTitle, description, finalChapterId, id];
            req.db.query(sql, params, (err, result) => {
                if (err) {
                    console.error('Failed to update assessment:', err);
                    return res.status(500).json({ error: 'Failed to update assessment.', details: err.message });
                }
                res.json({ success: 'Assessment updated successfully!' });
            });
        });
    }
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

// === Question CRUD Routes ===

// Create a new question for an assessment
router.post('/questions', (req, res) => {
    const { assessment_id, question_text, question_type, correct_answer, options } = req.body;
    if (assessment_id == null || !question_text || !question_type || correct_answer == null) {
        return res.status(400).json({ error: 'Missing required fields for question.' });
    }
    const sql = 'INSERT INTO questions (assessment_id, question_text, question_type, correct_answer, options) VALUES (?, ?, ?, ?, ?)';
    const params = [assessment_id, question_text, question_type, correct_answer, JSON.stringify(options || [])];
    req.db.query(sql, params, (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Failed to create question: ${err.message}` });
        }
        res.status(201).json({ success: true, question_id: result.insertId });
    });
});

// Update a question
router.put('/questions/:id', (req, res) => {
    const { id } = req.params;
    const { question_text, question_type, correct_answer, options } = req.body;
    if (!question_text || !question_type || correct_answer == null) {
        return res.status(400).json({ error: 'Missing required fields for question update.' });
    }
    const sql = 'UPDATE questions SET question_text = ?, question_type = ?, correct_answer = ?, options = ? WHERE question_id = ?';
    const params = [question_text, question_type, correct_answer, JSON.stringify(options || []), id];
    req.db.query(sql, params, (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Failed to update question: ${err.message}` });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Question not found.' });
        }
        res.json({ success: true });
    });
});

// Delete a question
router.delete('/questions/:id', async (req, res) => {
    const { id } = req.params;
    const db = req.db.promise();

    try {
        // Start a transaction to ensure atomicity.
        await db.beginTransaction();

        // Step 1: Delete all answers associated with this question.
        // This is the primary dependency that prevents a question from being deleted.
        const deleteAnswersSql = 'DELETE FROM answers WHERE question_id = ?';
        await db.query(deleteAnswersSql, [id]);

        // Step 2: With dependencies gone, delete the question itself.
        const deleteQuestionSql = 'DELETE FROM questions WHERE question_id = ?';
        const [result] = await db.query(deleteQuestionSql, [id]);

        // Both operations were successful, so commit the transaction.
        await db.commit();

        if (result.affectedRows === 0) {
            // This is not an error. It simply means the question was already gone.
            // The desired state is achieved, so we return success.
            return res.status(200).json({ success: true, message: 'Question not found or already deleted.' });
        }

        // The question was successfully deleted.
        res.json({ success: true });

    } catch (err) {
        // If any error occurred, rollback the transaction to prevent partial data changes.
        await db.rollback();

        // Log the specific error to the server console for future debugging.
        console.error(`Failed to delete question with ID ${id}:`, err);

        // Send a generic but informative error message to the client.
        res.status(500).json({
            error: 'A server error occurred while deleting the question.',
            details: err.message
        });
    }
});

export default router;
