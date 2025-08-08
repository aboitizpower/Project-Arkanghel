import express from 'express';
import multer from 'multer';

const router = express.Router();

// Multer configuration for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/**
 * @route GET /employee/workstreams
 * @description Get all published workstreams for employees
 * @access Private (Employee)
 * @returns {Array} List of published workstreams with metadata
 */
router.get('/employee/workstreams', (req, res) => {
    const sql = `
        SELECT 
            w.workstream_id, 
            w.title, 
            w.description, 
            w.image_type, 
            w.created_at,
            (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE) AS chapters_count,
            (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE AND mc.title NOT LIKE '%Final Assessment%') as regular_chapters_count,
            (
                SELECT COUNT(DISTINCT a.assessment_id) 
                FROM assessments a
                JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE
            ) as assessments_count,
            (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE AND mc.title LIKE '%Final Assessment%') > 0 as has_final_assessment
        FROM workstreams w
        WHERE w.is_published = TRUE
        ORDER BY w.created_at DESC
    `;
    
    req.db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching workstreams:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Failed to fetch workstreams. Please try again later.' 
            });
        }
        res.json({ success: true, workstreams: results });
    });
});

/**
 * @route GET /employee/workstreams/:workstreamId
 * @description Get details of a specific workstream including published chapters
 * @access Private (Employee)
 * @param {string} workstreamId - The ID of the workstream
 * @returns {Object} Workstream details with chapters
 */
router.get('/employee/workstreams/:workstreamId', (req, res) => {
    const { workstreamId } = req.params;
    const { userId } = req.query;

    if (!workstreamId || isNaN(parseInt(workstreamId))) {
        return res.status(400).json({
            success: false,
            error: 'A valid workstream ID is required.'
        });
    }

    // First, get the workstream details
    const workstreamSql = `
        SELECT 
            w.workstream_id, 
            w.title, 
            w.description, 
            w.image_type,
            w.created_at
        FROM workstreams w
        WHERE w.workstream_id = ? AND w.is_published = TRUE
    `;

    req.db.query(workstreamSql, [workstreamId], (err, workstreamResults) => {
        if (err) {
            console.error('Error fetching workstream:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch workstream details.'
            });
        }

        if (workstreamResults.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workstream not found or not published.'
            });
        }

        const workstream = workstreamResults[0];
        
        // Then get all published chapters for this workstream
        const chaptersSql = `
            SELECT 
                mc.chapter_id,
                mc.title,
                mc.content,
                mc.order_index,
                mc.is_published,
                mc.video_filename,
                mc.video_mime_type,
                mc.pdf_filename,
                mc.pdf_mime_type,
                up.status as user_status,
                up.completed_at,
                a.assessment_id,
                (
                    SELECT COUNT(*) > 0 
                    FROM user_progress up2 
                    WHERE up2.chapter_id = mc.chapter_id 
                    AND up2.user_id = ? 
                    AND up2.status = 'completed'
                ) as is_completed
            FROM module_chapters mc
            LEFT JOIN user_progress up ON mc.chapter_id = up.chapter_id AND up.user_id = ?
            LEFT JOIN assessments a ON mc.chapter_id = a.chapter_id
            WHERE mc.workstream_id = ? AND mc.is_published = TRUE
            ORDER BY mc.order_index ASC
        `;

        req.db.query(chaptersSql, [userId, userId, workstreamId], (err, chaptersResults) => {
            if (err) {
                console.error('Error fetching chapters:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch chapters.'
                });
            }

            // Format the response
            const response = {
                success: true,
                workstream: {
                    ...workstream,
                    image_url: workstream.image_type ? `/workstreams/${workstream.workstream_id}/image` : null
                },
                chapters: chaptersResults.map(chapter => ({
                    ...chapter,
                    video_url: chapter.video_filename ? `/chapters/${chapter.chapter_id}/video` : null,
                    pdf_url: chapter.pdf_filename ? `/chapters/${chapter.chapter_id}/pdf` : null,
                    has_assessment: !!chapter.assessment_id
                }))
            };

            res.json(response);
        });
    });
});

/**
 * @route GET /employee/chapters/:chapterId
 * @description Get details of a specific chapter
 * @access Private (Employee)
 * @param {string} chapterId - The ID of the chapter
 * @returns {Object} Chapter details with content and media information
 */
router.get('/employee/chapters/:chapterId', (req, res) => {
    const { chapterId } = req.params;
    const { userId } = req.query;

    if (!chapterId || isNaN(parseInt(chapterId))) {
        return res.status(400).json({
            success: false,
            error: 'A valid chapter ID is required.'
        });
    }

    const sql = `
        SELECT 
            mc.chapter_id,
            mc.workstream_id,
            mc.title,
            mc.content,
            mc.order_index,
            mc.video_filename,
            mc.video_mime_type,
            mc.pdf_filename,
            mc.pdf_mime_type,
            mc.created_at,
            w.title as workstream_title,
            w.image_type as workstream_image_type,
            up.status as user_status,
            up.completed_at,
            a.assessment_id,
            (
                SELECT COUNT(*) > 0 
                FROM user_progress up2 
                WHERE up2.chapter_id = mc.chapter_id 
                AND up2.user_id = ? 
                AND up2.status = 'completed'
            ) as is_completed
        FROM module_chapters mc
        JOIN workstreams w ON mc.workstream_id = w.workstream_id
        LEFT JOIN user_progress up ON mc.chapter_id = up.chapter_id AND up.user_id = ?
        LEFT JOIN assessments a ON mc.chapter_id = a.chapter_id
        WHERE mc.chapter_id = ? AND mc.is_published = TRUE AND w.is_published = TRUE
    `;

    req.db.query(sql, [userId, userId, chapterId], (err, results) => {
        if (err) {
            console.error('Error fetching chapter:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch chapter details.'
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Chapter not found, not published, or you do not have access.'
            });
        }

        const chapter = results[0];
        
        // Format the response
        const response = {
            success: true,
            chapter: {
                ...chapter,
                video_url: chapter.video_filename ? `/chapters/${chapter.chapter_id}/video` : null,
                pdf_url: chapter.pdf_filename ? `/chapters/${chapter.chapter_id}/pdf` : null,
                workstream_image_url: chapter.workstream_image_type ? `/workstreams/${chapter.workstream_id}/image` : null,
                has_assessment: !!chapter.assessment_id
            }
        };

        // If this is the first time the user is viewing this chapter, mark it as started
        if (userId && (!chapter.user_status || chapter.user_status === 'not_started')) {
            const updateProgressSql = `
                INSERT INTO user_progress (user_id, chapter_id, status, started_at)
                VALUES (?, ?, 'in_progress', NOW())
                ON DUPLICATE KEY UPDATE status = 'in_progress', updated_at = NOW()
            `;
            
            req.db.query(updateProgressSql, [userId, chapterId], (err) => {
                if (err) {
                    console.error('Error updating user progress:', err);
                    // Don't fail the request if progress update fails
                }
            });
        }

        res.json(response);
    });
});

/**
 * @route POST /employee/progress
 * @description Update user progress for a chapter
 * @access Private (Employee)
 * @param {string} userId - The ID of the user
 * @param {string} chapterId - The ID of the chapter
 * @param {string} status - The status to set ('in_progress' or 'completed')
 * @returns {Object} Success or error message
 */
router.post('/employee/progress', (req, res) => {
    const { userId, chapterId, status } = req.body;

    if (!userId || !chapterId || !['in_progress', 'completed'].includes(status)) {
        return res.status(400).json({
            success: false,
            error: 'User ID, chapter ID, and valid status are required.'
        });
    }

    const sql = `
        INSERT INTO user_progress (user_id, chapter_id, status, started_at, completed_at)
        VALUES (?, ?, ?, NOW(), ${status === 'completed' ? 'NOW()' : 'NULL'})
        ON DUPLICATE KEY UPDATE 
            status = VALUES(status),
            ${status === 'completed' ? 'completed_at = NOW(),' : ''}
            updated_at = NOW()
    `;

    req.db.query(sql, [userId, chapterId, status], (err, result) => {
        if (err) {
            console.error('Error updating progress:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to update progress.'
            });
        }

        res.json({
            success: true,
            message: 'Progress updated successfully.'
        });
    });
});

/**
 * @route GET /employee/workstreams/:workstreamId/progress
 * @description Get user's progress for a specific workstream
 * @access Private (Employee)
 * @param {string} workstreamId - The ID of the workstream
 * @param {string} userId - The ID of the user
 * @returns {Object} Progress information for the workstream
 */
router.get('/employee/workstreams/:workstreamId/progress', (req, res) => {
    const { workstreamId } = req.params;
    const { userId } = req.query;

    if (!workstreamId || isNaN(parseInt(workstreamId)) || !userId || isNaN(parseInt(userId))) {
        return res.status(400).json({
            success: false,
            error: 'Valid workstream ID and user ID are required.'
        });
    }

    const sql = `
        SELECT 
            mc.chapter_id,
            mc.title as chapter_title,
            mc.order_index,
            up.status,
            up.started_at,
            up.completed_at,
            a.assessment_id,
            (
                SELECT COUNT(*) > 0 
                FROM user_progress up2 
                WHERE up2.chapter_id = mc.chapter_id 
                AND up2.user_id = ? 
                AND up2.status = 'completed'
            ) as is_completed
        FROM module_chapters mc
        LEFT JOIN user_progress up ON mc.chapter_id = up.chapter_id AND up.user_id = ?
        LEFT JOIN assessments a ON mc.chapter_id = a.chapter_id
        WHERE mc.workstream_id = ? AND mc.is_published = TRUE
        ORDER BY mc.order_index ASC
    `;

    req.db.query(sql, [userId, userId, workstreamId], (err, results) => {
        if (err) {
            console.error('Error fetching progress:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch progress.'
            });
        }

        // Calculate overall progress
        const totalChapters = results.length;
        const completedChapters = results.filter(chapter => chapter.is_completed).length;
        const progress = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

        res.json({
            success: true,
            progress: {
                total: totalChapters,
                completed: completedChapters,
                percentage: progress
            },
            chapters: results.map(chapter => ({
                chapter_id: chapter.chapter_id,
                title: chapter.chapter_title,
                order_index: chapter.order_index,
                status: chapter.status || 'not_started',
                started_at: chapter.started_at,
                completed_at: chapter.completed_at,
                has_assessment: !!chapter.assessment_id,
                is_completed: chapter.is_completed
            }))
        });
    });
});

export default router;
