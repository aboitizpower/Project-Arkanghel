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
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ 
            success: false, 
            error: 'User ID is required to fetch workstream progress.' 
        });
    }

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
            COALESCE((
                SELECT 
                    CASE 
                        WHEN total_items = 0 THEN 0
                        ELSE (completed_items * 100.0) / total_items
                    END
                FROM (
                    SELECT 
                        -- Count completed chapters
                        COALESCE((
                            SELECT COUNT(DISTINCT up.chapter_id)
                            FROM user_progress up
                            JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
                            WHERE up.user_id = ? 
                              AND mc.workstream_id = w.workstream_id 
                              AND up.is_completed = TRUE
                              AND mc.is_published = TRUE
                        ), 0) +
                        -- Count passed assessments
                        COALESCE((
                            SELECT COUNT(DISTINCT a.assessment_id)
                            FROM assessments a
                            JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                            WHERE mc.workstream_id = w.workstream_id 
                              AND mc.is_published = TRUE
                              AND EXISTS (
                                  SELECT 1
                                  FROM answers ans
                                  JOIN questions q ON ans.question_id = q.question_id
                                  WHERE q.assessment_id = a.assessment_id 
                                    AND ans.user_id = ?
                                  GROUP BY q.assessment_id
                                  HAVING SUM(ans.score) >= a.passing_score
                              )
                        ), 0) as completed_items,
                        -- Total chapters + assessments
                        COALESCE((
                            SELECT COUNT(*) 
                            FROM module_chapters mc 
                            WHERE mc.workstream_id = w.workstream_id 
                              AND mc.is_published = TRUE
                        ), 0) +
                        COALESCE((
                            SELECT COUNT(DISTINCT a.assessment_id) 
                            FROM assessments a 
                            JOIN module_chapters mc ON a.chapter_id = mc.chapter_id 
                            WHERE mc.workstream_id = w.workstream_id 
                              AND mc.is_published = TRUE
                        ), 0) as total_items
                ) as progress_calc
            ), 0) as progress,
            (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE AND mc.title LIKE '%Final Assessment%') > 0 as has_final_assessment
        FROM workstreams w
        WHERE w.is_published = TRUE
        ORDER BY w.created_at DESC
    `;

    req.db.query(sql, [userId, userId], (err, results) => {
        if (err) {
            console.error('Error fetching workstreams:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Failed to fetch workstreams. Please try again later.' 
            });
        }
        res.json(results);
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
                a.assessment_id,
                a.passing_score,
                (
                    SELECT COUNT(*) > 0 
                    FROM user_progress up 
                    WHERE up.chapter_id = mc.chapter_id AND up.user_id = ? AND up.is_completed = TRUE
                ) as is_completed,
                (
                    SELECT SUM(ans.score)
                    FROM answers ans
                    JOIN questions q ON ans.question_id = q.question_id
                    WHERE q.assessment_id = a.assessment_id AND ans.user_id = ?
                ) as user_score
            FROM module_chapters mc
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

            let previousChapterCleared = true;
            const chaptersWithLockStatus = chaptersResults.map(chapter => {
                const hasAssessment = chapter.assessment_id !== null;
                const assessmentPassed = hasAssessment && chapter.user_score >= chapter.passing_score;
                const chapterCompleted = !!chapter.is_completed;

                const isCleared = chapterCompleted && (!hasAssessment || assessmentPassed);
                const isLocked = !previousChapterCleared;

                previousChapterCleared = isCleared;

                return {
                    ...chapter,
                    video_url: chapter.video_filename ? `/chapters/${chapter.chapter_id}/video` : null,
                    pdf_url: chapter.pdf_filename ? `/chapters/${chapter.chapter_id}/pdf` : null,
                    has_assessment: hasAssessment,
                    is_locked: isLocked,
                    assessment_passed: assessmentPassed
                };
            });

            const response = {
                success: true,
                workstream: {
                    ...workstream,
                    image_url: workstream.image_type ? `/workstreams/${workstream.workstream_id}/image` : null
                },
                chapters: chaptersWithLockStatus
            };

            res.json(response);
        });
    });
});


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
            mc.title,
            mc.content,
            mc.order_index,
            mc.is_published,
            mc.video_filename,
            mc.video_mime_type,
            mc.pdf_filename,
            mc.pdf_mime_type,
            w.workstream_id,
            w.title as workstream_title,
            (
                SELECT COUNT(*) > 0 
                FROM user_progress up2 
                WHERE up2.chapter_id = mc.chapter_id AND up2.user_id = ?
            ) as is_completed,
            a.assessment_id
        FROM module_chapters mc
        JOIN workstreams w ON mc.workstream_id = w.workstream_id
        LEFT JOIN assessments a ON mc.chapter_id = a.chapter_id
        WHERE mc.chapter_id = ? AND mc.is_published = TRUE AND w.is_published = TRUE
    `;

    req.db.query(sql, [userId, chapterId], (err, results) => {
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
                error: 'Chapter not found or not published.'
            });
        }

        const chapter = results[0];

        const response = {
            success: true,
            chapter: {
                ...chapter,
                video_url: chapter.video_filename ? `/chapters/${chapter.chapter_id}/video` : null,
                pdf_url: chapter.pdf_filename ? `/chapters/${chapter.chapter_id}/pdf` : null,
                has_assessment: !!chapter.assessment_id
            }
        };

        if (userId && !chapter.is_completed) {
            const updateProgressSql = `
                INSERT INTO user_progress (user_id, chapter_id, started_at)
                VALUES (?, ?, NOW())
                ON DUPLICATE KEY UPDATE started_at = IF(started_at IS NULL, NOW(), started_at)
            `;
            req.db.query(updateProgressSql, [userId, chapterId], (err) => {
                if (err) {
                    console.error('Error updating user progress:', err);
                }
            });
        }

        res.json(response);
    });
});

router.get('/employee/chapters/:chapterId/assessment', (req, res) => {
    const { chapterId } = req.params;
    const { userId } = req.query;

    const sql = `
        SELECT 
            a.assessment_id, 
            a.title, 
            (SELECT COUNT(*) FROM questions WHERE assessment_id = a.assessment_id) as question_count
        FROM assessments a
        WHERE a.chapter_id = ?
    `;

    req.db.query(sql, [chapterId], (err, results) => {
        if (err) {
            console.error('Error fetching assessment for chapter:', err);
            return res.status(500).json({ success: false, error: 'Failed to fetch assessment details.' });
        }
        if (results.length > 0) {
            res.json({ success: true, assessment: results[0] });
        } else {
            res.json({ success: true, assessment: null });
        }
    });
});


router.post('/employee/progress', (req, res) => {
    const { userId, chapterId } = req.body;

    if (!userId || !chapterId) {
        return res.status(400).json({
            success: false,
            error: 'User ID and chapter ID are required.'
        });
    }

    const sql = `
        INSERT INTO user_progress (user_id, chapter_id, is_completed, completion_time)
        VALUES (?, ?, TRUE, NOW())
        ON DUPLICATE KEY UPDATE is_completed = TRUE, completion_time = NOW()
    `;

    req.db.query(sql, [userId, chapterId], (err, result) => {
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
            mc.video_filename,
            mc.pdf_filename,
            a.assessment_id,
            (SELECT COUNT(*) > 0 FROM user_progress up WHERE up.chapter_id = mc.chapter_id AND up.user_id = ?) as is_completed
        FROM module_chapters mc
        LEFT JOIN assessments a ON mc.chapter_id = a.chapter_id
        WHERE mc.workstream_id = ? AND mc.is_published = TRUE
        ORDER BY mc.order_index ASC
    `;

    req.db.query(sql, [userId, workstreamId], (err, results) => {
        if (err) {
            console.error('Error fetching progress:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch progress.'
            });
        }

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
                is_completed: !!chapter.is_completed,
                has_assessment: !!chapter.assessment_id,
                video_filename: chapter.video_filename,
                pdf_filename: chapter.pdf_filename
            }))
        });
    });
});


// Serve chapter videos
router.get('/chapters/:id/video', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT video_file, video_mime_type FROM module_chapters WHERE chapter_id = ?';
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0 || !results[0].video_file) {
            return res.status(404).json({ error: 'Video not found.' });
        }
        const { video_file, video_mime_type } = results[0];
        res.setHeader('Content-Type', video_mime_type);
        res.send(video_file);
    });
});

// Serve chapter PDFs
router.get('/chapters/:id/pdf', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT pdf_file, pdf_mime_type, pdf_filename FROM module_chapters WHERE chapter_id = ?';
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            console.error('PDF query error:', err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`PDF request for chapter ${id}:`, {
            found: results.length > 0,
            pdf_filename: results[0]?.pdf_filename,
            has_pdf_file: !!results[0]?.pdf_file,
            pdf_mime_type: results[0]?.pdf_mime_type
        });
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        
        if (!results[0].pdf_file) {
            // If no binary data but filename exists, return a placeholder message
            if (results[0].pdf_filename) {
                const placeholderHTML = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>PDF Not Available</title>
                        <style>
                            body { 
                                font-family: Arial, sans-serif; 
                                text-align: center; 
                                padding: 50px; 
                                background-color: #f5f5f5; 
                            }
                            .message { 
                                background: white; 
                                padding: 30px; 
                                border-radius: 8px; 
                                box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
                                max-width: 500px; 
                                margin: 0 auto; 
                            }
                            .filename { 
                                color: #666; 
                                font-style: italic; 
                                margin-top: 10px; 
                            }
                        </style>
                    </head>
                    <body>
                        <div class="message">
                            <h2>📄 PDF File Not Available</h2>
                            <p>The PDF file exists but the content was not properly uploaded to the database.</p>
                            <div class="filename">Expected file: ${results[0].pdf_filename}</div>
                            <p><strong>Solution:</strong> Please re-upload this PDF file through the admin panel.</p>
                        </div>
                    </body>
                    </html>
                `;
                res.setHeader('Content-Type', 'text/html');
                return res.send(placeholderHTML);
            }
            return res.status(404).json({ error: 'PDF file data not found in database.' });
        }
        
        const { pdf_file, pdf_mime_type } = results[0];
        res.setHeader('Content-Type', pdf_mime_type || 'application/pdf');
        res.send(pdf_file);
    });
});

export default router;
