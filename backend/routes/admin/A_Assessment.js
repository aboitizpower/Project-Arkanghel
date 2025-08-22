import express from 'express';

const router = express.Router();

// Consolidated KPI endpoint
router.get('/kpi', (req, res) => {
    const db = req.db;
    const kpiQueries = {
        totalWorkstreams: 'SELECT COUNT(*) as count FROM workstreams',
        totalChapters: 'SELECT COUNT(*) as count FROM module_chapters',
        totalAssessments: 'SELECT COUNT(*) as count FROM assessments',
        totalAssessmentsTaken: `
            SELECT COUNT(DISTINCT q.assessment_id, ans.user_id, ans.answered_at) as count
            FROM answers ans
            JOIN questions q ON ans.question_id = q.question_id
            WHERE ans.user_id IS NOT NULL AND ans.answered_at IS NOT NULL;
        `
    };

    const promises = Object.entries(kpiQueries).map(([key, sql]) => {
        return new Promise((resolve, reject) => {
            db.query(sql, (err, result) => {
                if (err) return reject(err);
                // The result from a COUNT query is an array with one object, e.g., [{ count: 5 }]
                resolve({ [key]: result[0].count });
            });
        });
    });

    Promise.all(promises)
        .then(results => {
            // Combine the array of objects into a single object
            const combinedKpis = results.reduce((acc, current) => ({ ...acc, ...current }), {});
            res.json(combinedKpis);
        })
        .catch(err => {
            console.error('FATAL: Error fetching consolidated KPIs:', err);
            res.status(500).json({ error: 'Failed to fetch KPIs.', details: err.message });
        });
});


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
    
    try {
        req.db.query(sql, (err, results) => {
            if (err) {
                console.error('SQL Error:', err.message);
                return res.status(500).json({ error: 'Failed to fetch assessments. SQL Error: ' + err.message });
            }
            res.json(results);
        });
    } catch (err) {
        console.error('FATAL: Error fetching assessments:', err);
        res.status(500).json({ error: 'Failed to fetch assessments.', details: err.message });
    }
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

// Get all assessment results for the main table - Used by A_Assessment.jsx
router.get('/assessment-results', (req, res) => {
    try {
        const db = req.db;
        const { workstream_id, chapter_id } = req.query;

        let sql = `
        WITH LatestScores AS (
            SELECT
                ans.user_id,
                q.assessment_id,
                ans.answered_at,
                SUM(ans.score) AS user_score,
                ROW_NUMBER() OVER(PARTITION BY ans.user_id, q.assessment_id ORDER BY ans.answered_at DESC) as rn
            FROM answers AS ans
            JOIN questions AS q ON ans.question_id = q.question_id
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
            u.first_name,
            u.last_name,
            a.assessment_id,
            a.title AS assessment_title,
            (SELECT COUNT(*) FROM questions q WHERE q.assessment_id = a.assessment_id) as total_questions,
            a.passing_score,
            ls.user_score,
            ac.total_attempts,
            ls.answered_at AS completed_at,
            ((ls.user_score / (SELECT COUNT(*) FROM questions q WHERE q.assessment_id = a.assessment_id)) * 100 >= a.passing_score) AS passed,
            w.workstream_id,
            mc.chapter_id,
            w.title as workstream_title,
            mc.title as chapter_title
        FROM LatestScores AS ls
        JOIN users AS u ON ls.user_id = u.user_id
        JOIN assessments AS a ON ls.assessment_id = a.assessment_id
        LEFT JOIN module_chapters AS mc ON a.chapter_id = mc.chapter_id
        LEFT JOIN workstreams AS w ON mc.workstream_id = w.workstream_id
        JOIN AttemptCounts AS ac ON ls.user_id = ac.user_id AND ls.assessment_id = ac.assessment_id
        WHERE ls.rn = 1
        `;

        let whereClauses = [];
        let params = [];

        if (workstream_id) {
            whereClauses.push('w.workstream_id = ?');
            params.push(workstream_id);
        }

        if (chapter_id) {
            whereClauses.push('a.chapter_id = ?');
            params.push(chapter_id);
        }

        if (whereClauses.length > 0) {
            sql += ` AND ${whereClauses.join(' AND ')}`;
        }

        sql += ' ORDER BY ls.answered_at DESC;';

        const queryCallback = (err, results) => {
            if (err) {
                console.error('FATAL: Error fetching assessment results:', err);
                return res.status(500).json({ 
                    error: 'Failed to fetch assessment results.', 
                    details: err.message, 
                    sqlState: err.sqlState 
                });
            }
            res.json(results);
        };

        if (params.length > 0) {
            db.query(sql, params, queryCallback);
        } else {
            db.query(sql, queryCallback);
        }

    } catch (err) {
        console.error('FATAL: Unhandled exception in /assessment-results route:', err);
        res.status(500).json({ error: 'An unexpected server error occurred.', details: err.message });
    }
});

// Endpoint to get all workstreams for filter dropdowns
router.get('/workstreams', (req, res) => {
    const sql = 'SELECT workstream_id, title FROM workstreams ORDER BY title';
    req.db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching workstreams for filters:', err);
            return res.status(500).json({ error: 'Failed to fetch workstreams' });
        }
        res.json(results);
    });
});

// Endpoint to get chapters for a specific workstream for filter dropdowns
router.get('/workstreams/:workstream_id/chapters', (req, res) => {
    const { workstream_id } = req.params;
    const sql = 'SELECT chapter_id, title FROM module_chapters WHERE workstream_id = ? ORDER BY order_index';
    req.db.query(sql, [workstream_id], (err, results) => {
        if (err) {
            console.error('Error fetching chapters for filters:', err);
            return res.status(500).json({ error: 'Failed to fetch chapters' });
        }
        res.json(results);
    });
});

export default router;
