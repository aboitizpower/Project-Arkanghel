import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
// Import notification service with error handling
let notificationService;
try {
    notificationService = (await import('../../services/notificationService.js')).default;
} catch (error) {
    console.log('⚠️ Notification service not available in workstream routes');
}

const router = express.Router();

// Multer configuration for handling image uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Accept images only
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

/**
 * @route GET /admin/workstreams
 * @description Get all workstreams with their chapter and assessment counts
 * @access Private (Admin)
 * @returns {Object} List of workstreams with metadata
 */
router.get('/workstreams', (req, res) => {
    const { published_only } = req.query;
    console.log('Fetching workstreams, published_only:', published_only);
    
    let sql = `
        SELECT 
            w.workstream_id as id,
            w.title, 
            w.description, 
            w.image_type,
            w.created_at, 
            w.is_published,
            w.deadline,
            (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id) as chapters_count,
            (SELECT COUNT(*) FROM assessments a JOIN module_chapters mc ON a.chapter_id = mc.chapter_id WHERE mc.workstream_id = w.workstream_id) as assessments_count
        FROM workstreams w
    `;
    
    // Add WHERE clause if published_only is requested
    if (published_only === 'true') {
        sql += ' WHERE w.is_published = TRUE';
    }
    
    sql += ' ORDER BY w.created_at DESC';
    
    req.db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching workstreams:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch workstreams. Please try again later.'
            });
        }
        
        // Add image_url for each workstream that has an image
        const workstreams = results.map(ws => ({
            ...ws,
            image_url: ws.image_type ? `/workstreams/${ws.id}/image` : null
        }));
        
        console.log(`Fetched ${workstreams.length} workstreams`);
        res.json({
            success: true,
            workstreams
        });
    });
});

/**
 * @route GET /admin/workstreams/:id
 * @description Get a single workstream by ID with its chapters and assessments
 * @access Private (Admin)
 * @param {string} id - Workstream ID
 * @returns {Object} Workstream details with chapters and assessments
 */
router.get('/workstreams/:id', (req, res) => {
    const { id } = req.params;
    console.log(`Fetching workstream with ID: ${id}`);
    
    if (!id || isNaN(parseInt(id))) {
        console.warn('Invalid workstream ID provided:', id);
        return res.status(400).json({
            success: false,
            error: 'A valid workstream ID is required.'
        });
    }
    
    // First, get the workstream details
    const workstreamSql = 'SELECT * FROM workstreams WHERE workstream_id = ?';
    
    req.db.query(workstreamSql, [id], (err, workstreamResults) => {
        if (err) {
            console.error(`Error fetching workstream ${id}:`, err);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch workstream. Please try again later.'
            });
        }
        
        if (workstreamResults.length === 0) {
            console.warn(`Workstream not found with ID: ${id}`);
            return res.status(404).json({
                success: false,
                error: 'Workstream not found.'
            });
        }
        
        const workstream = workstreamResults[0];
        
        // Then get all chapters for this workstream
        const chaptersSql = `
            SELECT 
                chapter_id as id,
                workstream_id,
                title,
                description,
                order_index,
                is_published,
                is_assessment,
                created_at
            FROM module_chapters 
            WHERE workstream_id = ? 
            ORDER BY order_index ASC
        `;
        
        req.db.query(chaptersSql, [id], (err, chapters) => {
            if (err) {
                console.error(`Error fetching chapters for workstream ${id}:`, err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch chapters. Please try again later.'
                });
            }
            
            // If no chapters, return the workstream with empty chapters array
            if (chapters.length === 0) {
                console.log(`No chapters found for workstream ${id}`);
                return res.json({
                    success: true,
                    workstream: {
                        ...workstream,
                        chapters: [],
                        image_url: workstream.image_type ? `/workstreams/${id}/image` : null
                    }
                });
            }
            
            // Get all assessments for these chapters
            const assessmentsSql = `
                SELECT 
                    a.assessment_id as id,
                    a.chapter_id,
                    a.title,
                    a.description,
                    a.passing_score,
                    a.total_points,
                    a.time_limit_minutes,
                    a.is_published,
                    a.is_final,
                    a.created_at
                FROM assessments a
                JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                WHERE mc.workstream_id = ?
                UNION
                SELECT 
                    a.assessment_id as id,
                    a.chapter_id,
                    a.title,
                    a.description,
                    a.passing_score,
                    a.total_points,
                    a.time_limit_minutes,
                    a.is_published,
                    a.is_final,
                    a.created_at
                FROM assessments a
                WHERE a.workstream_id = ? AND a.is_final = 1
                ORDER BY created_at ASC
            `;
            
            req.db.query(assessmentsSql, [id, id], (err, assessments) => {
                if (err) {
                    console.error(`Error fetching assessments for workstream ${id}:`, err);
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to fetch assessments. Please try again later.'
                    });
                }
                
                const final_assessments = assessments.filter(a => a.is_final);
                const chapterAssessments = assessments.filter(a => !a.is_final);

                // Group chapter-specific assessments by chapter_id
                const assessmentsByChapter = chapterAssessments.reduce((acc, assessment) => {
                    const key = assessment.chapter_id;
                    if (!acc[key]) {
                        acc[key] = [];
                    }
                    acc[key].push(assessment);
                    return acc;
                }, {});

                // Attach assessments to their respective chapters
                const chaptersWithAssessments = chapters.map(chapter => ({
                    ...chapter,
                    assessments: assessmentsByChapter[chapter.id] || []
                }));

                console.log(`Fetched workstream ${id} with ${chapters.length} chapters and ${assessments.length} total assessments`);

                res.json({
                    success: true,
                    workstream: {
                        ...workstream,
                        chapters: chaptersWithAssessments,
                        final_assessments: final_assessments || [], // Add final assessments array to workstream object
                        image_url: workstream.image_type ? `/workstreams/${id}/image` : null
                    }
                });
            });
        });
    });
});

/**
 * @route POST /admin/workstreams
 * @description Create a new workstream
 * @access Private (Admin)
 * @param {string} title - Workstream title
 * @param {string} description - Workstream description
 * @param {File} image - Optional image file
 * @returns {Object} Created workstream data
 */
router.post('/workstreams', upload.single('image'), (req, res) => {
    console.log('=== A_WORKSTREAMS POST /workstreams ROUTE HIT ==='); // Debug log
    console.log('Creating new workstream');
    const { title, description, deadline } = req.body;
    console.log('A_Workstreams POST received:', { title, description, deadline }); // Debug log
    console.log('A_Workstreams POST req.body:', req.body); // Debug log
    
    // Input validation
    if (!title || !description) {
        console.warn('Missing required fields for workstream creation');
        return res.status(400).json({
            success: false,
            error: 'Title and description are required.'
        });
    }
    
    // Validate title length
    if (title.length < 3 || title.length > 100) {
        return res.status(400).json({
            success: false,
            error: 'Title must be between 3 and 100 characters.'
        });
    }
    
    // Validate description length
    if (description.length < 10 || description.length > 1000) {
        return res.status(400).json({
            success: false,
            error: 'Description must be between 10 and 1000 characters.'
        });
    }
    
    // Validate deadline format if provided
    let deadlineValue = null;
    if (deadline) {
        // Check if deadline is already in MySQL format (YYYY-MM-DD HH:mm:ss)
        const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
        if (mysqlDateRegex.test(deadline)) {
            // Already in correct format
            deadlineValue = deadline;
            console.log('POST: Deadline already in MySQL format:', deadlineValue); // Debug log
        } else {
            // Try to parse as ISO string and convert
            const deadlineDate = new Date(deadline);
            if (isNaN(deadlineDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid deadline format. Please use a valid date.'
                });
            }
            // Convert to MySQL datetime format (YYYY-MM-DD HH:mm:ss)
            deadlineValue = deadlineDate.toISOString().slice(0, 19).replace('T', ' ');
            console.log('POST: Converted deadline to MySQL format:', deadlineValue); // Debug log
        }
    }
    
    const image = req.file ? req.file.buffer : null;
    const image_type = req.file ? req.file.mimetype : null;
    
    // Start a transaction to ensure data consistency
    req.db.beginTransaction(err => {
        if (err) {
            console.error('Error beginning transaction for workstream creation:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to create workstream. Please try again.'
            });
        }
        
        // First, insert the workstream
        const workstreamSql = `
            INSERT INTO workstreams 
            (title, description, image, image_type, deadline, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        `;
        
        console.log('A_Workstreams POST executing SQL:', workstreamSql); // Debug log
        console.log('A_Workstreams POST with params:', [title, description, image ? 'IMAGE_BUFFER' : null, image_type, deadlineValue]); // Debug log
        
        req.db.query(workstreamSql, [title, description, image, image_type, deadlineValue], (err, result) => {
            if (err) {
                console.error('Error creating workstream:', err);
                return req.db.rollback(() => {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to create workstream. Please try again.'
                    });
                });
            }
            
            const workstreamId = result.insertId;
            console.log(`Created workstream with ID: ${workstreamId}`);
            
            // Create a default final assessment chapter
            const finalAssessmentChapterSql = `
                INSERT INTO module_chapters 
                (workstream_id, title, description, order_index, is_published, is_assessment, created_at)
                VALUES (?, 'Final Assessment', 'Final assessment for this workstream', 1, FALSE, TRUE, NOW())
            `;
            
            req.db.query(finalAssessmentChapterSql, [workstreamId], (err, chapterResult) => {
                if (err) {
                    console.error('Error creating final assessment chapter:', err);
                    return req.db.rollback(() => {
                        res.status(500).json({
                            success: false,
                            error: 'Failed to create final assessment chapter. Please try again.'
                        });
                    });
                }
                
                const chapterId = chapterResult.insertId;
                console.log(`Created final assessment chapter with ID: ${chapterId}`);
                
                // Create a default assessment for the final assessment chapter
                const assessmentSql = `
                    INSERT INTO assessments 
                    (chapter_id, title, description, passing_score, total_points, time_limit_minutes, is_published, created_at)
                    VALUES (?, 'Final Assessment', 'Final assessment for this workstream', 70, 100, 60, FALSE, NOW())
                `;
                
                req.db.query(assessmentSql, [chapterId], (err) => {
                    if (err) {
                        console.error('Error creating final assessment:', err);
                        return req.db.rollback(() => {
                            res.status(500).json({
                                success: false,
                                error: 'Failed to create final assessment. Please try again.'
                            });
                        });
                    }
                    
                    // Commit the transaction
                    req.db.commit(err => {
                        if (err) {
                            console.error('Error committing transaction:', err);
                            return req.db.rollback(() => {
                                res.status(500).json({
                                    success: false,
                                    error: 'Failed to complete workstream creation. Please try again.'
                                });
                            });
                        }
                        
                        console.log(`Successfully created workstream with ID: ${workstreamId}`);
                        res.status(201).json({
                            success: true,
                            message: 'Workstream created successfully! Remember to publish it to send email notifications to all users about this new training workstream.',
                            workstream: {
                                id: workstreamId,
                                title,
                                description,
                                image_url: image_type ? `/workstreams/${workstreamId}/image` : null,
                                is_published: false,
                                created_at: new Date().toISOString(),
                                chapters: []
                            }
                        });
                    });
                });
            });
        });
    });
});

/**
 * @route PUT /admin/workstreams/:id
 * @description Update a workstream
 * @access Private (Admin)
 * @param {string} id - Workstream ID
 * @param {string} title - Updated title
 * @param {string} description - Updated description
 * @param {File} image - Optional updated image file
 * @returns {Object} Updated workstream data
 */
router.put('/workstreams/:id', upload.single('image'), (req, res) => {
    console.log('=== PUT /workstreams/:id ROUTE HIT ==='); // Debug log
    const { id } = req.params;
    const { title, description, deadline } = req.body;
    
    console.log(`Updating workstream with ID: ${id}`);
    console.log('Full req.body:', req.body); // Debug log
    console.log('Received update request:', { id, title, description, deadline }); // Debug log
    
    // Input validation
    if (!id || isNaN(parseInt(id))) {
        console.warn('Invalid workstream ID provided:', id);
        return res.status(400).json({
            success: false,
            error: 'A valid workstream ID is required.'
        });
    }
    
    if (!title || !description) {
        console.warn('Missing required fields for workstream update');
        return res.status(400).json({
            success: false,
            error: 'Title and description are required.'
        });
    }
    
    // Validate title length
    if (title.length < 3 || title.length > 100) {
        return res.status(400).json({
            success: false,
            error: 'Title must be between 3 and 100 characters.'
        });
    }
    
    // Validate description length
    if (description.length < 10 || description.length > 1000) {
        return res.status(400).json({
            success: false,
            error: 'Description must be between 10 and 1000 characters.'
        });
    }
    
    // Validate deadline format if provided
    let deadlineValue = null;
    if (deadline !== undefined) {
        if (deadline === null || deadline === '') {
            deadlineValue = null; // Allow clearing the deadline
        } else {
            // Check if deadline is already in MySQL format (YYYY-MM-DD HH:mm:ss)
            const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
            if (mysqlDateRegex.test(deadline)) {
                // Already in correct format
                deadlineValue = deadline;
                console.log('PUT: Deadline already in MySQL format:', deadlineValue); // Debug log
            } else {
                try {
                    const deadlineDate = new Date(deadline);
                    if (isNaN(deadlineDate.getTime())) {
                        console.log('Invalid deadline format:', deadline); // Debug log
                        return res.status(400).json({ error: 'Invalid deadline format. Please use a valid date.' });
                    }
                    // Convert to MySQL datetime format (YYYY-MM-DD HH:mm:ss)
                    deadlineValue = deadlineDate.toISOString().slice(0, 19).replace('T', ' ');
                    console.log('PUT: Converted deadline to MySQL format:', deadlineValue); // Debug log
                } catch (err) {
                    console.log('Error parsing deadline:', err);
                    return res.status(400).json({ error: 'Invalid deadline format. Please use a valid date.' });
                }
            }
        }
    }
    
    // Build the update query dynamically based on provided fields
    let updateSql = 'UPDATE workstreams SET title = ?, description = ?';
    const updateParams = [title, description];
    
    // Add deadline if provided
    if (deadline !== undefined) {
        updateSql += ', deadline = ?';
        updateParams.push(deadlineValue);
    }
    
    // Add image fields if a new image was uploaded
    if (req.file) {
        updateSql += ', image = ?, image_type = ?';
        updateParams.push(req.file.buffer, req.file.mimetype);
    }
    
    // Add updated_at timestamp and complete the WHERE clause
    updateSql += ', updated_at = NOW() WHERE workstream_id = ?';
    updateParams.push(id);
    
    // Start a transaction to ensure data consistency
    req.db.beginTransaction(err => {
        if (err) {
            console.error('Error beginning transaction for workstream update:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to update workstream. Please try again.'
            });
        }
        
        // Update the workstream
        console.log('Executing SQL:', updateSql, 'with params:', updateParams); // Debug log
        req.db.query(updateSql, updateParams, (err, result) => {
            if (err) {
                console.error(`Error updating workstream ${id}:`, err);
                return req.db.rollback(() => {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to update workstream. Please try again.'
                    });
                });
            }
            
            if (result.affectedRows === 0) {
                return req.db.rollback(() => {
                    res.status(404).json({
                        success: false,
                        error: 'Workstream not found.'
                    });
                });
            }
            
            // Fetch the updated workstream with its chapters and assessments
            const fetchSql = `
                SELECT 
                    w.*,
                    (SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'id', mc.chapter_id,
                            'workstream_id', mc.workstream_id,
                            'title', mc.title,
                            'description', mc.description,
                            'order_index', mc.order_index,
                            'is_published', mc.is_published,
                            'is_assessment', mc.is_assessment,
                            'created_at', mc.created_at,
                            'assessments', IFNULL((
                                SELECT JSON_ARRAYAGG(
                                    JSON_OBJECT(
                                        'id', a.assessment_id,
                                        'chapter_id', a.chapter_id,
                                        'title', a.title,
                                        'description', a.description,
                                        'passing_score', a.passing_score,
                                        'total_points', a.total_points,
                                        'time_limit_minutes', a.time_limit_minutes,
                                        'is_published', a.is_published,
                                        'created_at', a.created_at
                                    )
                                )
                                FROM assessments a
                                WHERE a.chapter_id = mc.chapter_id
                                ORDER BY a.created_at ASC
                            ), JSON_ARRAY())
                        )
                    )
                    FROM module_chapters mc
                    WHERE mc.workstream_id = w.workstream_id
                    ORDER BY mc.order_index ASC
                ) as chapters
                FROM workstreams w
                WHERE w.workstream_id = ?
            `;
            
            req.db.query(fetchSql, [id], (err, results) => {
                if (err) {
                    console.error(`Error fetching updated workstream ${id}:`, err);
                    return req.db.rollback(() => {
                        res.status(500).json({
                            success: false,
                            error: 'Failed to fetch updated workstream. Please refresh the page.'
                        });
                    });
                }
                
                if (results.length === 0) {
                    return req.db.rollback(() => {
                        res.status(404).json({
                            success: false,
                            error: 'Workstream not found after update.'
                        });
                    });
                }
                
                const updatedWorkstream = results[0];
                console.log('Fetched updated workstream:', updatedWorkstream); // Debug log
                console.log('Deadline in fetched workstream:', updatedWorkstream.deadline); // Debug log
                
                // Parse the JSON string for chapters if it exists
                if (updatedWorkstream.chapters) {
                    updatedWorkstream.chapters = JSON.parse(updatedWorkstream.chapters);
                } else {
                    updatedWorkstream.chapters = [];
                }
                
                // Commit the transaction
                req.db.commit(err => {
                    if (err) {
                        console.error('Error committing transaction:', err);
                        return req.db.rollback(() => {
                            res.status(500).json({
                                success: false,
                                error: 'Failed to complete workstream update. Please try again.'
                            });
                        });
                    }
                    
                    console.log(`Successfully updated workstream with ID: ${id}`);
                    const responseWorkstream = {
                        ...updatedWorkstream,
                        image_url: updatedWorkstream.image_type ? `/workstreams/${id}/image` : null
                    };
                    console.log('Sending response workstream:', responseWorkstream); // Debug log
                    console.log('Response workstream deadline:', responseWorkstream.deadline); // Debug log
                    res.json({
                        success: true,
                        message: 'Workstream updated successfully!',
                        workstream: responseWorkstream
                    });
                });
            });
        });
    });
});

/**
 * @route PUT /admin/workstreams/:id/publish
 * @description Toggle the published status of a workstream
 * @access Private (Admin)
 * @param {string} id - Workstream ID
 * @param {boolean} is_published - Whether to publish or unpublish
 * @returns {Object} Success or error message
 */
router.put('/workstreams/:id/publish', (req, res) => {
    const { id } = req.params;
    const { is_published } = req.body;
    
    console.log(`Updating publish status for workstream ${id} to: ${is_published}`);
    
    // Input validation
    if (!id || isNaN(parseInt(id))) {
        console.warn('Invalid workstream ID provided for publish status update:', id);
        return res.status(400).json({
            success: false,
            error: 'A valid workstream ID is required.'
        });
    }
    
    if (is_published === undefined || is_published === null) {
        console.warn('Missing is_published in request body');
        return res.status(400).json({
            success: false,
            error: 'is_published field is required.'
        });
    }
    
    // First, check if the workstream has at least one published chapter
    if (is_published) {
        const checkChaptersSql = `
            SELECT COUNT(*) as published_chapters
            FROM module_chapters
            WHERE workstream_id = ? AND is_published = TRUE
        `;
        
        req.db.query(checkChaptersSql, [id], (err, results) => {
            if (err) {
                console.error(`Error checking published chapters for workstream ${id}:`, err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to verify workstream publish status. Please try again.'
                });
            }
            
            if (results[0].published_chapters === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot publish a workstream with no published chapters.'
                });
            }
            
            // Proceed with updating the publish status
            updatePublishStatus();
        });
    } else {
        // If unpublishing, no need to check for published chapters
        updatePublishStatus();
    }
    
    function updatePublishStatus() {
        const updateSql = 'UPDATE workstreams SET is_published = ? WHERE workstream_id = ?';
        
        req.db.query(updateSql, [is_published ? 1 : 0, id], (err, result) => {
            if (err) {
                console.error(`Error updating publish status for workstream ${id}:`, err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update workstream status. Please try again.'
                });
            }
            
            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Workstream not found.'
                });
            }
            
            console.log(`Successfully updated publish status for workstream ${id} to: ${is_published}`);
            
            // Send notification if workstream is being published
            if (is_published) {
                console.log(`🔔 Attempting to send notifications for workstream ${id}...`);
                
                if (notificationService) {
                    notificationService.notifyNewWorkstream(id)
                        .then(() => {
                            console.log(`✅ Email notifications sent successfully for workstream ${id}`);
                            res.json({
                                success: true,
                                message: `Workstream published successfully! Email notifications are being sent to all users. Please allow 2-5 minutes for delivery to all email accounts.`,
                                workstream_id: id,
                                is_published: 1
                            });
                        })
                        .catch(err => {
                            console.error(`❌ Failed to send new workstream notifications for ${id}:`, err);
                            res.json({
                                success: true,
                                message: `Workstream published successfully! Note: Email notifications could not be sent at this time. Please try again later or contact support.`,
                                workstream_id: id,
                                is_published: 1
                            });
                        });
                } else {
                    console.log(`⚠️ Notification service not available - skipping email notifications`);
                    res.json({
                        success: true,
                        message: `Workstream published successfully! Note: Email notification service is currently unavailable.`,
                        workstream_id: id,
                        is_published: 1
                    });
                }
            } else {
                console.log(`📝 Workstream ${id} unpublished - no notifications sent`);
                res.json({
                    success: true,
                    message: `Workstream unpublished successfully!`,
                    workstream_id: id,
                    is_published: 0
                });
            }
        });
    }
});

/**
 * @route DELETE /admin/workstreams/:id
 * @description Delete a workstream and all its associated data
 * @access Private (Admin)
 * @param {string} id - Workstream ID to delete
 * @returns {Object} Success or error message
 */
router.delete('/workstreams/:id', (req, res) => {
    const { id } = req.params;
    console.log(`Attempting to delete workstream with ID: ${id}`);
    
    // Input validation
    if (!id || isNaN(parseInt(id))) {
        console.warn('Invalid workstream ID provided for deletion:', id);
        return res.status(400).json({
            success: false,
            error: 'A valid workstream ID is required.'
        });
    }
    
    // Start a transaction to ensure data consistency
    req.db.beginTransaction(err => {
        if (err) {
            console.error('Error beginning transaction for workstream deletion:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to initiate workstream deletion. Please try again.'
            });
        }
        
        // 1. First, get all chapter IDs for this workstream to delete related data
        const getChaptersSql = 'SELECT chapter_id FROM module_chapters WHERE workstream_id = ?';
        
        req.db.query(getChaptersSql, [id], (err, chapters) => {
            if (err) {
                console.error('Error fetching chapters for workstream deletion:', err);
                return req.db.rollback(() => {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to fetch workstream data for deletion. Please try again.'
                    });
                });
            }
            
            const chapterIds = chapters.map(ch => ch.chapter_id);
            
            // If there are chapters, delete related data first
            if (chapterIds.length > 0) {
                // Delete assessment results for these chapters
                const deleteAssessmentResultsSql = `
                    DELETE ar FROM assessment_results ar
                    JOIN assessments a ON ar.assessment_id = a.assessment_id
                    WHERE a.chapter_id IN (?)
                `;
                
                req.db.query(deleteAssessmentResultsSql, [chapterIds], (err) => {
                    if (err) {
                        console.error('Error deleting assessment results:', err);
                        return req.db.rollback(() => {
                            res.status(500).json({
                                success: false,
                                error: 'Failed to delete workstream assessment data. Please try again.'
                            });
                        });
                    }
                    
                    // Delete questions for these chapters
                    const deleteQuestionsSql = `
                        DELETE q FROM questions q
                        JOIN assessments a ON q.assessment_id = a.assessment_id
                        WHERE a.chapter_id IN (?)
                    `;
                    
                    req.db.query(deleteQuestionsSql, [chapterIds], (err) => {
                        if (err) {
                            console.error('Error deleting questions:', err);
                            return req.db.rollback(() => {
                                res.status(500).json({
                                    success: false,
                                    error: 'Failed to delete workstream questions. Please try again.'
                                });
                            });
                        }
                        
                        // Delete answers for these chapters
                        const deleteAnswersSql = `
                            DELETE ans FROM answers ans
                            JOIN questions q ON ans.question_id = q.question_id
                            JOIN assessments a ON q.assessment_id = a.assessment_id
                            WHERE a.chapter_id IN (?)
                        `;
                        
                        req.db.query(deleteAnswersSql, [chapterIds], (err) => {
                            if (err) {
                                console.error('Error deleting answers:', err);
                                return req.db.rollback(() => {
                                    res.status(500).json({
                                        success: false,
                                        error: 'Failed to delete workstream answers. Please try again.'
                                    });
                                });
                            }
                            
                            // Delete assessments for these chapters
                            const deleteAssessmentsSql = 'DELETE FROM assessments WHERE chapter_id IN (?)';
                            
                            req.db.query(deleteAssessmentsSql, [chapterIds], (err) => {
                                if (err) {
                                    console.error('Error deleting assessments:', err);
                                    return req.db.rollback(() => {
                                        res.status(500).json({
                                            success: false,
                                            error: 'Failed to delete workstream assessments. Please try again.'
                                        });
                                    });
                                }
                                
                                // Delete chapter content for these chapters
                                const deleteChapterContentSql = 'DELETE FROM chapter_content WHERE chapter_id IN (?)';
                                
                                req.db.query(deleteChapterContentSql, [chapterIds], (err) => {
                                    if (err) {
                                        console.error('Error deleting chapter content:', err);
                                        return req.db.rollback(() => {
                                            res.status(500).json({
                                                success: false,
                                                error: 'Failed to delete workstream chapter content. Please try again.'
                                            });
                                        });
                                    }
                                    
                                    // Finally, delete the chapters
                                    deleteChapters();
                                });
                            });
                        });
                    });
                });
            } else {
                // No chapters to delete, proceed to delete the workstream
                deleteWorkstream();
            }
            
            function deleteChapters() {
                const deleteChaptersSql = 'DELETE FROM module_chapters WHERE workstream_id = ?';
                
                req.db.query(deleteChaptersSql, [id], (err) => {
                    if (err) {
                        console.error('Error deleting chapters:', err);
                        return req.db.rollback(() => {
                            res.status(500).json({
                                success: false,
                                error: 'Failed to delete workstream chapters. Please try again.'
                            });
                        });
                    }
                    
                    // Now delete the workstream itself
                    deleteWorkstream();
                });
            }
            
            function deleteWorkstream() {
                const deleteWorkstreamSql = 'DELETE FROM workstreams WHERE workstream_id = ?';
                
                req.db.query(deleteWorkstreamSql, [id], (err, result) => {
                    if (err) {
                        console.error('Error deleting workstream:', err);
                        return req.db.rollback(() => {
                            res.status(500).json({
                                success: false,
                                error: 'Failed to delete workstream. Please try again.'
                            });
                        });
                    }
                    
                    if (result.affectedRows === 0) {
                        return req.db.rollback(() => {
                            res.status(404).json({
                                success: false,
                                error: 'Workstream not found.'
                            });
                        });
                    }
                    
                    // Commit the transaction
                    req.db.commit(err => {
                        if (err) {
                            console.error('Error committing transaction:', err);
                            return req.db.rollback(() => {
                                res.status(500).json({
                                    success: false,
                                    error: 'Failed to complete workstream deletion. Please try again.'
                                });
                            });
                        }
                        
                        console.log(`Successfully deleted workstream with ID: ${id}`);
                        res.json({
                            success: true,
                            message: 'Workstream deleted successfully!',
                            workstream_id: id
                        });
                    });
                });
            }
        });
    });
});

/**
 * @route GET /workstreams/:id/complete
 * @description Get complete workstream data with chapters and assessments
 * @access Private (Admin)
 * @param {string} id - Workstream ID
 * @returns {Object} Complete workstream data
 */
/**
 * @route GET /workstreams/:id/assessments
 * @description Get all assessments for a specific workstream
 * @access Private (Admin)
 * @param {string} id - Workstream ID
 * @returns {Array} List of assessments
 */
/**
 * @route POST /workstreams/:id/assessments
 * @description Create a new assessment for a workstream
 * @access Private (Admin)
 * @param {string} id - Workstream ID
 * @returns {Object} Success message and ID of the new assessment
 */
router.post('/workstreams/:id/assessments', (req, res) => {
    const { id: workstream_id } = req.params;
    const { title, description, questions, chapter_id, is_final } = req.body;

    if (!title || !questions || questions.length === 0) {
        return res.status(400).json({ error: 'Title and at least one question are required.' });
    }

    const createAssessmentInTransaction = (target_chapter_id) => {
        req.db.beginTransaction(err => {
            if (err) {
                console.error('Error starting transaction:', err);
                return res.status(500).json({ error: 'Failed to create assessment.' });
            }

            // Unified SQL for all assessments
            const assessmentSql = `
                INSERT INTO assessments (title, description, chapter_id, is_final, created_at, updated_at)
                VALUES (?, ?, ?, ?, NOW(), NOW())
            `;
            const assessmentValues = [title, description, target_chapter_id, is_final ? 1 : 0];

            req.db.query(assessmentSql, assessmentValues, (err, result) => {
                if (err) {
                    return req.db.rollback(() => {
                        console.error('Error creating assessment:', err);
                        res.status(500).json({ error: 'Failed to save assessment.' });
                    });
                }

                const assessmentId = result.insertId;
                const questionsSql = `
                    INSERT INTO questions (assessment_id, question_text, question_type, options, correct_answer)
                    VALUES ?
                `;
                const questionValues = questions.map(q => [
                    assessmentId,
                    q.question,
                    q.question_type,
                    JSON.stringify(q.options),
                    JSON.stringify(q.correct_answer)
                ]);

                req.db.query(questionsSql, [questionValues], (err) => {
                    if (err) {
                        return req.db.rollback(() => {
                            console.error('Error creating assessment questions:', err);
                            res.status(500).json({ error: 'Failed to save questions.' });
                        });
                    }

                    req.db.commit(err => {
                        if (err) {
                            return req.db.rollback(() => {
                                console.error('Error committing transaction:', err);
                                res.status(500).json({ error: 'Failed to finalize assessment creation.' });
                            });
                        }
                        res.status(201).json({
                            success: true,
                            message: 'Assessment created successfully!',
                            assessmentId: assessmentId
                        });
                    });
                });
            });
        });
    };

    if (is_final) {
        // For a final assessment, create a new chapter dedicated to it.
        req.db.beginTransaction(err => {
            if (err) { return res.status(500).json({ error: 'Failed to start transaction.' }); }

            const getMaxOrderSql = 'SELECT MAX(order_index) as max_order FROM module_chapters WHERE workstream_id = ?';
            req.db.query(getMaxOrderSql, [workstream_id], (err, result) => {
                if (err) {
                    return req.db.rollback(() => res.status(500).json({ error: 'Failed to determine chapter order.' }));
                }

                const newOrder = (result[0].max_order || 0) + 1;
                const chapterTitle = `Final Assessment`;

                const createChapterSql = 'INSERT INTO module_chapters (workstream_id, title, order_index) VALUES (?, ?, ?)';
                req.db.query(createChapterSql, [workstream_id, chapterTitle, newOrder], (err, chapterResult) => {
                    if (err) {
                        return req.db.rollback(() => res.status(500).json({ error: 'Failed to create dedicated chapter for final assessment.' }));
                    }

                    const newChapterId = chapterResult.insertId;
                    // Now call the original transaction function with the new chapter ID
                    createAssessmentInTransaction(newChapterId);
                });
            });
        });
    } else {
        // For a regular chapter assessment, a chapter_id is required.
        if (!chapter_id) {
            return res.status(400).json({ error: 'Chapter ID is required for a non-final assessment.' });
        }
        createAssessmentInTransaction(chapter_id);
    }
});

router.get('/workstreams/:id/assessments', (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'A valid workstream ID is required.' });
    }

    const sql = `
        SELECT a.* 
        FROM assessments a
        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
        WHERE mc.workstream_id = ?
    `;

    req.db.query(sql, [id], (err, results) => {
        if (err) {
            console.error(`Error fetching assessments for workstream ${id}:`, err);
            return res.status(500).json({ error: 'Failed to fetch assessments.' });
        }
        res.json(results);
    });
});
router.get('/workstreams/:id/complete', (req, res) => {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Valid workstream ID is required.' });
    }

    // Fetch the workstream
    const workstreamSql = 'SELECT * FROM workstreams WHERE workstream_id = ?';
    req.db.query(workstreamSql, [id], (err, workstreamResults) => {
        if (err) {
            return res.status(500).json({ error: `Failed to fetch workstream: ${err.message}` });
        }
        if (workstreamResults.length === 0) {
            return res.status(404).json({ error: 'Workstream not found.' });
        }

        const workstream = workstreamResults[0];
        console.log('Complete endpoint - fetched workstream:', workstream); // Debug log
        console.log('Complete endpoint - workstream deadline:', workstream.deadline); // Debug log

        // Fetch chapters (ordered)
        const chaptersSql = 'SELECT * FROM module_chapters WHERE workstream_id = ? ORDER BY order_index ASC';
        req.db.query(chaptersSql, [id], (err, chapters) => {
            if (err) {
                return res.status(500).json({ error: `Failed to fetch chapters: ${err.message}` });
            }

            // Fetch ALL assessments for this workstream, including standalone/final (chapter_id IS NULL)
            const assessmentsSql = `
                SELECT        
                    a.assessment_id, a.chapter_id, a.title, a.description, a.passing_score,
                    a.total_points, a.time_limit_minutes, a.is_published, a.created_at, a.is_final
                FROM assessments a
                JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                WHERE mc.workstream_id = ?
                ORDER BY a.created_at ASC
            `;

            req.db.query(assessmentsSql, [id, id], (err, assessments) => {
                if (err) {
                    return res.status(500).json({ error: `Failed to fetch assessments: ${err.message}` });
                }

                const finalAssessments = assessments.filter(a => a.is_final);
                const finalAssessmentChapterIds = new Set(finalAssessments.map(a => a.chapter_id));

                const regularChapters = chapters.filter(ch => !finalAssessmentChapterIds.has(ch.chapter_id));

                const assessmentsByChapter = assessments.reduce((acc, a) => {
                    if (a.chapter_id && !a.is_final) {
                        (acc[a.chapter_id] = acc[a.chapter_id] || []).push(a);
                    }
                    return acc;
                }, {});

                const chaptersWithAssessments = regularChapters.map(ch => ({
                    ...ch,
                    assessments: assessmentsByChapter[ch.chapter_id] || []
                }));

                const responsePayload = {
                    ...workstream,
                    deadline: workstream.deadline, // Explicitly include deadline
                    chapters: chaptersWithAssessments,
                    final_assessments: finalAssessments, // Send final assessments separately
                    image_url: workstream.image_type ? `/workstreams/${id}/image` : null
                };

                console.log('Complete endpoint - sending response:', responsePayload); // Debug log
                console.log('Complete endpoint - response deadline:', responsePayload.deadline); // Debug log
                res.json(responsePayload);
            });
        });
    });
});

export default router;
