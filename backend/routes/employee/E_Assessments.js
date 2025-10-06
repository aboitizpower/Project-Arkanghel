import express from 'express';

const router = express.Router();

// Get assessment results for a user - Used by E_Assessments.jsx (E_AssessmentResults.jsx)
router.get('/employee/assessment-results/:userId', (req, res) => {
    const { userId } = req.params;
    
    console.log(`Fetching assessment results for user ID: ${userId}`);
    
    const sql = `
        WITH LatestScores AS (
            SELECT
                ans.user_id,
                q.assessment_id,
                ans.answered_at,
                SUM(ans.score) AS user_score,
                ROW_NUMBER() OVER(PARTITION BY ans.user_id, q.assessment_id ORDER BY ans.answered_at DESC) as rn
            FROM answers AS ans
            JOIN questions AS q ON ans.question_id = q.question_id
            WHERE ans.user_id = ?
            GROUP BY ans.user_id, q.assessment_id, ans.answered_at
        ),
        AttemptCounts AS (
            SELECT user_id, assessment_id, COUNT(*) AS total_attempts
            FROM LatestScores
            GROUP BY user_id, assessment_id
        )
        SELECT
            CONCAT(ls.user_id, '-', ls.assessment_id) AS result_id,
            ls.user_id,
            a.assessment_id,
            ls.user_score as score,
            (SELECT COUNT(*) FROM questions q WHERE q.assessment_id = a.assessment_id) as total_questions,
            ls.answered_at AS completed_at,
            a.title AS assessment_title,
            a.total_points,
            a.passing_score,
            mc.title AS chapter_title,
            w.title AS workstream_title,
            w.workstream_id,
            ((ls.user_score / (SELECT COUNT(*) FROM questions q WHERE q.assessment_id = a.assessment_id)) * 100 >= a.passing_score) AS passed,
            ac.total_attempts
        FROM LatestScores AS ls
        JOIN assessments AS a ON ls.assessment_id = a.assessment_id
        LEFT JOIN module_chapters AS mc ON a.chapter_id = mc.chapter_id
        LEFT JOIN workstreams AS w ON mc.workstream_id = w.workstream_id
        JOIN AttemptCounts AS ac ON ls.user_id = ac.user_id AND ls.assessment_id = ac.assessment_id
        WHERE ls.rn = 1
        ORDER BY ls.answered_at DESC
    `;
    
    req.db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error(`Error fetching assessment results for user ${userId}:`, err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`Found ${results.length} assessment results for user ${userId}`);
        res.json(results);
    });
});

// Get all attempts for a specific assessment by a user - Used by E_Assessment.jsx modal
router.get('/employee/assessment-attempts/:userId/:assessmentId', (req, res) => {
    const { userId, assessmentId } = req.params;
    
    console.log(`Fetching all attempts for user ID: ${userId}, assessment ID: ${assessmentId}`);
    
    const sql = `
        SELECT
            ans.answered_at as completed_at,
            SUM(ans.score) AS score,
            (SELECT COUNT(*) FROM questions q WHERE q.assessment_id = ?) as total_questions,
            a.total_points,
            a.passing_score,
            ((SUM(ans.score) / (SELECT COUNT(*) FROM questions q WHERE q.assessment_id = ?)) * 100 >= a.passing_score) AS passed
        FROM answers AS ans
        JOIN questions AS q ON ans.question_id = q.question_id
        JOIN assessments AS a ON q.assessment_id = a.assessment_id
        WHERE ans.user_id = ? AND q.assessment_id = ?
        GROUP BY ans.answered_at, a.total_points, a.passing_score
        ORDER BY ans.answered_at ASC
    `;
    
    req.db.query(sql, [assessmentId, assessmentId, userId, assessmentId], (err, results) => {
        if (err) {
            console.error(`Error fetching assessment attempts for user ${userId}, assessment ${assessmentId}:`, err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`Found ${results.length} attempts for user ${userId}, assessment ${assessmentId}`);
        res.json(results);
    });
});

export default router;
