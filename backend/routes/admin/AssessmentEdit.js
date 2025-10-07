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
    const { title, description, is_final, chapter_id, workstream_id, deadline } = req.body;

    // Automatically set is_final if the title is 'Final Assessment'
    if (title && title.trim().toLowerCase() === 'final assessment') {
        is_final = true;
    }

    if (title === undefined || description === undefined || is_final === undefined) {
        return res.status(400).json({ error: 'title, description, and is_final are required.' });
    }

    // Validate deadline format if provided
    let deadlineValue = null;
    if (deadline !== undefined) {
        if (deadline === null || deadline === '') {
            deadlineValue = null; // Allow clearing the deadline
        } else {
            const deadlineDate = new Date(deadline);
            if (isNaN(deadlineDate.getTime())) {
                return res.status(400).json({ error: 'Invalid deadline format. Please use a valid date.' });
            }
            deadlineValue = deadlineDate;
        }
    }

    const updateAssessment = (target_chapter_id) => {
        let sql, params;
        if (deadline !== undefined) {
            sql = 'UPDATE assessments SET title = ?, description = ?, is_final = ?, chapter_id = ?, deadline = ?, updated_at = NOW() WHERE assessment_id = ?';
            params = [title, description, is_final, target_chapter_id, deadlineValue, id];
        } else {
            sql = 'UPDATE assessments SET title = ?, description = ?, is_final = ?, chapter_id = ?, updated_at = NOW() WHERE assessment_id = ?';
            params = [title, description, is_final, target_chapter_id, id];
        }
        
        req.db.query(sql, params, (err, result) => {
            if (err) {
                console.error('Failed to update assessment:', err);
                return res.status(500).json({ error: 'Failed to update assessment.', details: err.message });
            }
            res.json({ success: true, message: 'Assessment updated successfully!' });
        });
    };

    if (is_final) {
        if (!workstream_id) {
            return res.status(400).json({ error: 'Workstream ID is required to create a final assessment chapter.' });
        }

        req.db.query('SELECT title FROM workstreams WHERE workstream_id = ?', [workstream_id], (err, workstreams) => {
            if (err || workstreams.length === 0) {
                return res.status(404).json({ error: 'Workstream not found when creating final assessment chapter.' });
            }
            const workstreamTitle = workstreams[0].title;
            const finalChapterTitle = `Final Assessment for: ${workstreamTitle}`;

            const findChapterSql = `SELECT chapter_id FROM module_chapters WHERE workstream_id = ? AND title = ?`;
            req.db.query(findChapterSql, [workstream_id, finalChapterTitle], (err, chapters) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to find final assessment chapter.' });
                }

                if (chapters.length > 0) {
                    updateAssessment(chapters[0].chapter_id);
                } else {
                    const getNextOrderIndexSql = `SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM module_chapters WHERE workstream_id = ?`;
                    req.db.query(getNextOrderIndexSql, [workstream_id], (err, result) => {
                        if (err) {
                            return res.status(500).json({ error: 'Failed to get next order index.' });
                        }
                        const nextOrderIndex = result[0].next_order;
                        const createChapterSql = `INSERT INTO module_chapters (workstream_id, title, description, order_index, is_assessment) VALUES (?, ?, ?, ?, 1)`;
                        req.db.query(createChapterSql, [workstream_id, finalChapterTitle, `Final assessment for the ${workstreamTitle} workstream.`, nextOrderIndex], (err, result) => {
                            if (err) {
                                return res.status(500).json({ error: 'Failed to create final assessment chapter.' });
                            }
                            updateAssessment(result.insertId);
                        });
                    });
                }
            });
        });
    } else {
        if (chapter_id === undefined) {
            return res.status(400).json({ error: 'chapter_id is required for non-final assessments.' });
        }
        updateAssessment(chapter_id);
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
    
    // Handle options based on question type
    let optionsString = null;
    if (question_type === 'multiple_choice') {
        // Multiple choice needs options array
        if (options && Array.isArray(options) && options.length > 0) {
            const cleanOptions = options.filter(opt => opt && opt.toString().trim() !== '');
            optionsString = JSON.stringify(cleanOptions);
        } else {
            optionsString = '[]'; // Fallback empty array
        }
    } else if (question_type === 'true_false' || question_type === 'identification') {
        // True/False and Identification questions don't need options
        optionsString = null;
    }
    
    const sql = 'INSERT INTO questions (assessment_id, question_text, question_type, correct_answer, options) VALUES (?, ?, ?, ?, ?)';
    const params = [assessment_id, question_text, question_type, correct_answer, optionsString];
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

    // Handle options based on question type
    let optionsString = null;
    if (question_type === 'multiple_choice') {
        // Multiple choice needs options array
        if (options && Array.isArray(options) && options.length > 0) {
            const cleanOptions = options.filter(opt => opt && opt.toString().trim() !== '');
            optionsString = JSON.stringify(cleanOptions);
        } else if (typeof options === 'string' && options.trim() !== '') {
            // If options is a string, try to parse it or split by comma
            try {
                const parsed = JSON.parse(options);
                optionsString = JSON.stringify(Array.isArray(parsed) ? parsed : [parsed]);
            } catch (e) {
                // Split by comma and clean
                const splitOptions = options.split(',').map(s => s.trim()).filter(s => s);
                optionsString = JSON.stringify(splitOptions);
            }
        } else {
            optionsString = '[]'; // Fallback empty array for multiple choice
        }
    } else if (question_type === 'true_false' || question_type === 'identification') {
        // True/False and Identification questions don't need options
        optionsString = null;
    }

    console.log(`Updating question ${id} with options:`, optionsString);

    const sql = 'UPDATE questions SET question_text = ?, question_type = ?, correct_answer = ?, options = ? WHERE question_id = ?';
    const params = [question_text, question_type, correct_answer, optionsString, id];
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
