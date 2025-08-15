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
    const { id: assessmentId } = req.params;
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: 'A non-empty array of questions is required.' });
    }

    req.db.beginTransaction(async (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to start transaction.', details: err.message });
        }

        try {
            for (const question of questions) {
                const { question_text, question_type, points, correct_answer, options } = question;

                // Ensure options are properly formatted as JSON string
                let optionsString = '[]'; // Default to empty array
                
                if (options) {
                    if (Array.isArray(options) && options.length > 0) {
                        // Clean and validate options array
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
                    }
                }

                console.log(`Creating question ${question_text.substring(0, 50)}... with options:`, optionsString);

                const questionSql = 'INSERT INTO questions (assessment_id, question_text, question_type, points, correct_answer, options) VALUES (?, ?, ?, ?, ?, ?)';
                await req.db.promise().query(questionSql, [assessmentId, question_text, question_type, points, correct_answer, optionsString]);
            }

            req.db.commit((err) => {
                if (err) {
                    return req.db.rollback(() => {
                        res.status(500).json({ error: 'Failed to commit transaction.', details: err.message });
                    });
                }
                res.status(201).json({ success: 'Assessment questions created successfully!' });
            });
        } catch (error) {
            req.db.rollback(() => {
                res.status(500).json({ error: 'Failed to create assessment questions.', details: error.message });
            });
        }
    });
});

export default router;
