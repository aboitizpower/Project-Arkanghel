import express from 'express';

const router = express.Router();

// Get all assessments - Used by A_Assessment.jsx
router.get('/assessments', (req, res) => {
    const sql = `
        SELECT 
            a.assessment_id,
            a.chapter_id,
            a.title,
            a.total_points,
            a.passing_score,
            a.created_at,
            mc.title as chapter_title,
            w.title as workstream_title,
            w.workstream_id,
            (SELECT COUNT(*) FROM questions q WHERE q.assessment_id = a.assessment_id) as questions_count
        FROM assessments a
        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
        JOIN workstreams w ON mc.workstream_id = w.workstream_id
        ORDER BY a.created_at DESC
    `;
    
    req.db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Get a specific assessment with questions and answers - Used by A_Assessment.jsx
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

export default router;
