import express from 'express';

const router = express.Router();

// Get assessment results for a user - Used by E_Assessments.jsx (E_AssessmentResults.jsx)
router.get('/employee/assessment-results/:userId', (req, res) => {
    const { userId } = req.params;
    
    const sql = `
        SELECT 
            ar.result_id,
            ar.user_id,
            ar.assessment_id,
            ar.score,
            ar.total_questions,
            ar.completed_at,
            a.title as assessment_title,
            a.total_points,
            a.passing_score,
            mc.title as chapter_title,
            w.title as workstream_title,
            (ar.score >= a.passing_score) as passed
        FROM assessment_results ar
        JOIN assessments a ON ar.assessment_id = a.assessment_id
        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
        JOIN workstreams w ON mc.workstream_id = w.workstream_id
        WHERE ar.user_id = ?
        ORDER BY ar.completed_at DESC
    `;
    
    req.db.query(sql, [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

export default router;
