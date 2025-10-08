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
    // Get user ID from authenticated user (set by auth middleware)
    const userId = req.user?.id;

    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'User authentication required to fetch workstream progress.'
        });
    }

    const sql = `
        SELECT 
            w.workstream_id, 
            w.title, 
            w.description, 
            w.image_type, 
            w.created_at,
            w.deadline,
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
                        -- Count passed assessments (75% passing threshold)
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
                                  HAVING (SUM(ans.score) * 100.0 / COUNT(q.question_id)) >= 75
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
          AND (
            NOT EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = ?)
            OR EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = ? AND uwp.workstream_id = w.workstream_id AND uwp.has_access = TRUE)
          )
        ORDER BY w.created_at ASC
    `;

    req.db.query(sql, [userId, userId, userId, userId], (err, results) => {
        if (err) {
            console.error('Error fetching workstreams:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch workstreams. Please try again later.'
            });
        }

        // Add deadline status to each workstream
        const now = new Date();
        const workstreamsWithDeadlineStatus = results.map(workstream => {
            const deadline = workstream.deadline ? new Date(workstream.deadline) : null;
            const isExpired = deadline && now > deadline;

            return {
                ...workstream,
                deadline: deadline ? deadline.toISOString() : null,
                is_expired: isExpired
            };
        });

        res.json(workstreamsWithDeadlineStatus);
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
    const userId = req.user?.id;

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
            w.created_at,
            w.deadline,
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
                        -- Count passed assessments (75% passing threshold)
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
                                  HAVING (SUM(ans.score) * 100.0 / COUNT(q.question_id)) >= 75
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
            ), 0) as progress
        FROM workstreams w
        WHERE w.workstream_id = ? AND w.is_published = TRUE
          AND (
            NOT EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = ?)
            OR EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = ? AND uwp.workstream_id = w.workstream_id AND uwp.has_access = TRUE)
          )
    `;

    req.db.query(workstreamSql, [userId, userId, workstreamId, userId, userId], (err, workstreamResults) => {
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

        // Check if workstream has expired
        const now = new Date();
        const deadline = workstream.deadline ? new Date(workstream.deadline) : null;
        const isExpired = deadline && now > deadline;

        if (isExpired) {
            return res.status(403).json({
                success: false,
                error: 'This workstream deadline has passed. You can no longer access this workstream.',
                expired: true,
                deadline: deadline.toISOString(),
                current_time: now.toISOString()
            });
        }

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
    const userId = req.user?.id;

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
    const userId = req.user?.id;

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


router.get('/user-progress/:userId/:workstreamId', (req, res) => {
    const { userId, workstreamId } = req.params;

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

/**
 * @route GET /employee/assessment/:assessmentId/passed
 * @description Check if user has passed a specific assessment
 * @access Private (Employee)
 * @param {string} assessmentId - The ID of the assessment
 * @param {string} userId - The ID of the user (query parameter)
 * @returns {Object} Pass status and score information
 */
router.get('/employee/assessment/:assessmentId/passed', (req, res) => {
    const { assessmentId } = req.params;
    const userId = req.user?.id;

    if (!assessmentId || !userId) {
        return res.status(400).json({
            success: false,
            error: 'Assessment ID and User ID are required.'
        });
    }

    const sql = `
        SELECT 
            COUNT(q.question_id) as total_questions,
            COALESCE(SUM(ans.score), 0) as total_score,
            CASE 
                WHEN COUNT(q.question_id) > 0 THEN 
                    (COALESCE(SUM(ans.score), 0) * 100.0 / COUNT(q.question_id)) >= 75
                ELSE FALSE 
            END as passed
        FROM questions q
        LEFT JOIN answers ans ON q.question_id = ans.question_id AND ans.user_id = ?
        WHERE q.assessment_id = ?
    `;

    req.db.query(sql, [userId, assessmentId], (err, results) => {
        if (err) {
            console.error('Error checking assessment pass status:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to check assessment status.'
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Assessment not found.'
            });
        }

        const result = results[0];
        res.json({
            success: true,
            passed: result.passed === 1,
            total_questions: result.total_questions,
            total_score: result.total_score,
            percentage: result.total_questions > 0 ? Math.round((result.total_score / result.total_questions) * 100) : 0
        });
    });
});

/**
 * @route GET /employee/assessment/:assessmentId/perfect-score
 * @description Check if user has completed any assessment with perfect score (100%)
 * @access Private (Employee)
 * @param {string} assessmentId - The ID of the assessment
 * @param {string} userId - The ID of the user (query parameter)
 * @returns {Object} Perfect score completion status
 */
router.get('/employee/assessment/:assessmentId/perfect-score', (req, res) => {
    const { assessmentId } = req.params;
    const userId = req.user?.id;

    if (!assessmentId || !userId) {
        return res.status(400).json({
            success: false,
            error: 'Assessment ID and User ID are required.'
        });
    }

    // First get the total questions for this assessment
    const totalQuestionsSql = `
        SELECT COUNT(*) as total_questions
        FROM questions 
        WHERE assessment_id = ?
    `;

    // Check if user has ever achieved a perfect score on any attempt
    const perfectScoreCheckSql = `
        SELECT 
            mc.title as chapter_title,
            a.title as assessment_title,
            CASE 
                WHEN mc.title LIKE '%Final Assessment%' OR mc.title LIKE '%final assessment%' THEN 1
                ELSE 0 
            END as is_final_assessment,
            CASE 
                WHEN EXISTS (
                    SELECT 1 
                    FROM (
                        SELECT 
                            DATE(ans2.answered_at) as attempt_date,
                            COUNT(DISTINCT q2.question_id) as total_questions,
                            COUNT(DISTINCT CASE WHEN ans2.score = 1 THEN q2.question_id END) as correct_answers
                        FROM questions q2
                        INNER JOIN answers ans2 ON q2.question_id = ans2.question_id 
                        WHERE q2.assessment_id = ? AND ans2.user_id = ?
                        GROUP BY DATE(ans2.answered_at)
                        HAVING correct_answers = total_questions AND total_questions > 0
                    ) perfect_attempts
                ) THEN 1
                ELSE 0
            END as has_perfect_attempt
        FROM assessments a
        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
        WHERE a.assessment_id = ?
    `;

    // Execute both queries
    req.db.query(totalQuestionsSql, [assessmentId], (err, totalResults) => {
        if (err) {
            console.error('Error getting total questions:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to check assessment status.'
            });
        }

        const totalQuestions = totalResults[0]?.total_questions || 0;

        req.db.query(perfectScoreCheckSql, [assessmentId, userId, assessmentId], (err, perfectResults) => {
            if (err) {
                console.error('Error checking perfect score:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to check perfect score.'
                });
            }

            // If no results, assessment not found
            if (perfectResults.length === 0) {
                return res.json({
                    success: true,
                    is_final_assessment: false,
                    has_perfect_score: false,
                    completed_with_perfect_score: false,
                    total_questions: totalQuestions,
                    total_score: 0,
                    chapter_title: null,
                    assessment_title: null
                });
            }

            const result = perfectResults[0];
            const hasPerfectScore = result.has_perfect_attempt === 1;

            console.log(`Perfect score check for user ${userId}, assessment ${assessmentId}:`, {
                total_questions: totalQuestions,
                has_perfect_attempt: result.has_perfect_attempt,
                has_perfect_score: hasPerfectScore,
                chapter_title: result.chapter_title,
                assessment_title: result.assessment_title
            });

            res.json({
                success: true,
                is_final_assessment: result.is_final_assessment === 1,
                has_perfect_score: hasPerfectScore,
                completed_with_perfect_score: hasPerfectScore,
                total_questions: totalQuestions,
                total_score: 0, // Not relevant for perfect score check
                chapter_title: result.chapter_title,
                assessment_title: result.assessment_title
            });
        });
    });
});

/**
 * @route GET /employee/workstreams/:workstreamId/last-viewed-chapter
 * @description Get the last viewed or completed chapter for a user in a workstream
 * @access Private (Employee)
 * @returns {Object} The last viewed chapter ID
 */
router.get('/employee/workstreams/:workstreamId/last-viewed-chapter', (req, res) => {
    const { workstreamId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required.' });
    }

    // First, find the most recently completed chapter for the user in the workstream
    const lastViewedSql = `
        SELECT up.chapter_id
        FROM user_progress up
        JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
        WHERE up.user_id = ? AND mc.workstream_id = ? AND up.is_completed = TRUE
        ORDER BY up.completion_time DESC
        LIMIT 1;
    `;

    req.db.query(lastViewedSql, [userId, workstreamId], (err, results) => {
        if (err) {
            console.error('Error fetching last viewed chapter:', err);
            return res.status(500).json({ error: 'Failed to fetch last viewed chapter.' });
        }

        if (results.length > 0) {
            // If a last-viewed chapter is found, return it
            return res.json({ chapterId: results[0].chapter_id });
        } else {
            // If no progress is found, find the first chapter of the workstream
            const firstChapterSql = `
                SELECT chapter_id 
                FROM module_chapters 
                WHERE workstream_id = ? AND is_published = TRUE
                ORDER BY order_index ASC
                LIMIT 1;
            `;
            req.db.query(firstChapterSql, [workstreamId], (err, firstChapterResults) => {
                if (err) {
                    console.error('Error fetching first chapter:', err);
                    return res.status(500).json({ error: 'Failed to fetch first chapter.' });
                }
                if (firstChapterResults.length > 0) {
                    res.json({ chapterId: firstChapterResults[0].chapter_id });
                } else {
                    res.status(404).json({ chapterId: null, message: 'No chapters found for this workstream.' });
                }
            });
        }
    });
});

// ally delete mo tong comment na to

export default router;
