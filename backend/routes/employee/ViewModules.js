import express from 'express';

const router = express.Router();

// Get a specific workstream for employee view - Used by ViewModules.jsx
router.get('/employee/workstreams/:id', (req, res) => {
    const { id } = req.params;
    const { userId } = req.query;
    
    const sql = `
        SELECT 
            w.workstream_id, 
            w.title, 
            w.description, 
            w.image_type, 
            w.created_at,
            w.is_published
        FROM workstreams w
        WHERE w.workstream_id = ? AND w.is_published = TRUE
    `;
    
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Workstream not found or not published.' });
        }
        
        const workstream = results[0];
        workstream.image_url = workstream.image_type ? `/workstreams/${id}/image` : null;
        res.json(workstream);
    });
});

// Get chapters for a specific workstream (employee view) - Used by ViewModules.jsx
router.get('/employee/workstreams/:id/chapters', (req, res) => {
    const { id } = req.params;
    
    const sql = `
        SELECT 
            chapter_id, 
            workstream_id, 
            title, 
            content, 
            order_index, 
            video_filename, 
            video_mime_type, 
            pdf_filename, 
            pdf_mime_type 
        FROM module_chapters 
        WHERE workstream_id = ? AND is_published = TRUE
        ORDER BY order_index ASC
    `;
    
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Add URLs for video and PDF content
        const chapters = results.map(chapter => ({
            ...chapter,
            video_url: chapter.video_filename ? `/chapters/${chapter.chapter_id}/video` : null,
            pdf_url: chapter.pdf_filename ? `/chapters/${chapter.chapter_id}/pdf` : null,
        }));
        
        res.json(chapters);
    });
});

// Get user progress for a specific workstream - Used by ViewModules.jsx
router.get('/employee/progress/:userId/:workstreamId', (req, res) => {
    const { userId, workstreamId } = req.params;
    
    const sql = `
        SELECT 
            up.user_id,
            up.chapter_id,
            up.status,
            up.completed_at,
            mc.title as chapter_title,
            mc.workstream_id
        FROM user_progress up
        JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
        WHERE up.user_id = ? AND mc.workstream_id = ?
        ORDER BY mc.order_index ASC
    `;
    
    req.db.query(sql, [userId, workstreamId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Get assessment for a specific chapter (employee view) - Used by ViewModules.jsx
router.get('/employee/chapters/:chapterId/assessment', (req, res) => {
    const { chapterId } = req.params;
    
    const sql = `
        SELECT 
            a.assessment_id,
            a.title,
            a.total_points,
            a.passing_score,
            a.chapter_id
        FROM assessments a
        WHERE a.chapter_id = ?
        LIMIT 1
    `;
    
    req.db.query(sql, [chapterId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'No assessment found for this chapter.' });
        }
        res.json(results[0]);
    });
});

// Get assessment results for a user and specific assessment - Used by ViewModules.jsx
router.get('/employee/assessment-results/:userId/:assessmentId', (req, res) => {
    const { userId, assessmentId } = req.params;
    
    const sql = `
        SELECT 
            ar.result_id,
            ar.user_id,
            ar.assessment_id,
            ar.score,
            ar.total_questions,
            ar.completed_at,
            a.passing_score,
            (ar.score >= a.passing_score) as passed
        FROM assessment_results ar
        JOIN assessments a ON ar.assessment_id = a.assessment_id
        WHERE ar.user_id = ? AND ar.assessment_id = ?
        ORDER BY ar.completed_at DESC
    `;
    
    req.db.query(sql, [userId, assessmentId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Mark chapter progress (employee view) - Used by ViewModules.jsx
router.post('/employee/progress', (req, res) => {
    const { user_id, chapter_id, workstream_id, status = 'viewed' } = req.body;
    
    if (!user_id || !chapter_id) {
        return res.status(400).json({ error: 'user_id and chapter_id are required.' });
    }
    
    // Check if progress already exists
    const checkSql = 'SELECT * FROM user_progress WHERE user_id = ? AND chapter_id = ?';
    req.db.query(checkSql, [user_id, chapter_id], (err, existing) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (existing.length > 0) {
            // Update existing progress
            const updateSql = 'UPDATE user_progress SET status = ?, completed_at = NOW() WHERE user_id = ? AND chapter_id = ?';
            req.db.query(updateSql, [status, user_id, chapter_id], (err, result) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: 'Progress updated successfully.' });
            });
        } else {
            // Insert new progress
            const insertSql = 'INSERT INTO user_progress (user_id, chapter_id, status, completed_at) VALUES (?, ?, ?, NOW())';
            req.db.query(insertSql, [user_id, chapter_id, status], (err, result) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: 'Progress recorded successfully.' });
            });
        }
    });
});

export default router;
