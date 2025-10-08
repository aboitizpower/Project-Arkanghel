import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

// Import notification service with error handling
let notificationService;
try {
    notificationService = (await import('../../services/notificationService.js')).default;
} catch (error) {
    console.log('⚠️ Notification service not available in A_Modules routes');
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
        // Accept images only if a file is provided
        if (file && !file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

/**
 * @route POST /workstreams
 * @description Create a new workstream with comprehensive validation and transaction support
 * @access Private (Admin)
 * @param {string} title - Workstream title
 * @param {string} description - Workstream description
 * @param {File} image - Optional image file
 * @param {string} deadline - Optional deadline
 * @returns {Object} Created workstream data
 */
router.post('/workstreams', upload.single('image'), (req, res) => {
    console.log('=== A_MODULES POST /workstreams ROUTE HIT ===');
    console.log('Creating new workstream');
    const { title, description, deadline } = req.body;
    console.log('A_Modules POST received:', { title, description, deadline });
    console.log('A_Modules POST req.body:', req.body);
    console.log('A_Modules POST req.file:', req.file ? 'FILE_PRESENT' : 'NO_FILE');
    
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
            console.log('POST: Deadline already in MySQL format:', deadlineValue);
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
            console.log('POST: Converted deadline to MySQL format:', deadlineValue);
        }
    }
    
    const image = req.file ? req.file.buffer : null;
    const image_type = req.file ? req.file.mimetype : null;
    
    // Start a transaction to ensure data consistency
    console.log('Starting database transaction...');
    req.db.beginTransaction(err => {
        if (err) {
            console.error('Error beginning transaction for workstream creation:', err);
            console.error('Transaction error details:', {
                code: err.code,
                errno: err.errno,
                sqlMessage: err.sqlMessage
            });
            return res.status(500).json({
                success: false,
                error: 'Failed to create workstream. Please try again.'
            });
        }
        console.log('Transaction started successfully');
        
        // First, insert the workstream
        const workstreamSql = `
            INSERT INTO workstreams 
            (title, description, image, image_type, deadline, is_published)
            VALUES (?, ?, ?, ?, ?, FALSE)
        `;
        
        console.log('A_Modules POST executing SQL:', workstreamSql);
        console.log('A_Modules POST with params:', [title, description, image ? 'IMAGE_BUFFER' : null, image_type, deadlineValue]);
        
        req.db.query(workstreamSql, [title, description, image, image_type, deadlineValue], (err, result) => {
            if (err) {
                console.error('Error creating workstream:', err);
                console.error('SQL Error details:', {
                    code: err.code,
                    errno: err.errno,
                    sqlMessage: err.sqlMessage,
                    sqlState: err.sqlState,
                    sql: err.sql
                });
                return req.db.rollback(() => {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to create workstream. Please try again.'
                    });
                });
            }
            
            const workstreamId = result.insertId;
            console.log(`Created workstream with ID: ${workstreamId}`);
            
            // Temporarily skip chapter/assessment creation for debugging
            console.log('Skipping chapter/assessment creation for debugging...');
            
            // Commit the transaction
            req.db.commit(err => {
                if (err) {
                    console.error('Error committing transaction:', err);
                    console.error('Commit error details:', {
                        code: err.code,
                        errno: err.errno,
                        sqlMessage: err.sqlMessage
                    });
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
                    message: 'Workstream created successfully! You can add chapters and assessments later.',
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

/**
 * @route GET /workstreams
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
 * @route DELETE /workstreams/:id
 * @description Delete a workstream and all its associated data with transaction support
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

// Read a single workstream (including image) - Used by WorkstreamEdit.jsx and for serving workstream images
router.get('/workstreams/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM workstreams WHERE workstream_id = ?';
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Workstream not found.' });
        }
        const workstream = results[0];
        // Send the image buffer directly if it exists
        if (workstream.image) {
            res.setHeader('Content-Type', workstream.image_type);
            res.send(workstream.image);
        } else {
            res.json(workstream); // Or send metadata if no image
        }
    });
});

// Get complete workstream data with chapters and assessments (for admin) - Used by A_Modules.jsx for detailed workstream view
router.get('/workstreams/:id/complete', (req, res) => {
    const { id } = req.params;
    
    // First get the workstream data
    const workstreamSql = 'SELECT workstream_id, title, description, image_type, created_at, is_published, deadline FROM workstreams WHERE workstream_id = ?';
    req.db.query(workstreamSql, [id], (err, workstreamResults) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (workstreamResults.length === 0) {
            return res.status(404).json({ error: 'Workstream not found.' });
        }
        
        const workstream = workstreamResults[0];
        console.log('A_Modules /complete endpoint - fetched workstream:', workstream); // Debug log
        console.log('A_Modules /complete endpoint - workstream deadline:', workstream.deadline); // Debug log
        
        // Then get all chapters for this workstream
        const chaptersSql = `
          SELECT 
            chapter_id, 
            workstream_id, 
            title, 
            content, 
            order_index, 
            is_published, 
            video_filename, 
            video_mime_type, 
            pdf_filename, 
            pdf_mime_type 
          FROM module_chapters 
          WHERE workstream_id = ? 
          ORDER BY order_index ASC
        `;
        req.db.query(chaptersSql, [id], (err, chapters) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // For each chapter, get its assessments
            const chapterIds = chapters.map(ch => ch.chapter_id);
            
            if (chapterIds.length === 0) {
                // No chapters, return workstream with empty chapters array
                const responsePayload = {
                    ...workstream,
                    chapters: [],
                    image_url: workstream.image_type ? `/workstreams/${id}/image` : null
                };
                console.log('A_Modules /complete endpoint - sending response (no chapters):', responsePayload); // Debug log
                console.log('A_Modules /complete endpoint - response deadline (no chapters):', responsePayload.deadline); // Debug log
                return res.json(responsePayload);
            }
            
            const assessmentsSql = 'SELECT assessment_id, chapter_id, title, total_points FROM assessments WHERE chapter_id IN (?) ORDER BY assessment_id ASC';
            req.db.query(assessmentsSql, [chapterIds], (err, assessments) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                // Group assessments by chapter
                const assessmentsByChapter = {};
                assessments.forEach(assessment => {
                    if (!assessmentsByChapter[assessment.chapter_id]) {
                        assessmentsByChapter[assessment.chapter_id] = [];
                    }
                    assessmentsByChapter[assessment.chapter_id].push(assessment);
                });
                
                // Add assessments to their respective chapters and add video/pdf URLs
                const chaptersWithAssessments = chapters.map(chapter => ({
                    ...chapter,
                    assessments: assessmentsByChapter[chapter.chapter_id] || [],
                    video_url: chapter.video_filename ? `/chapters/${chapter.chapter_id}/video` : null,
                    pdf_url: chapter.pdf_filename ? `/chapters/${chapter.chapter_id}/pdf` : null,
                }));
                
                const responsePayload = {
                    ...workstream,
                    chapters: chaptersWithAssessments,
                    image_url: workstream.image_type ? `/workstreams/${id}/image` : null
                };
                console.log('A_Modules /complete endpoint - sending response:', responsePayload); // Debug log
                console.log('A_Modules /complete endpoint - response deadline:', responsePayload.deadline); // Debug log
                res.json(responsePayload);
            });
        });
    });
});

/**
 * @route PUT /workstreams/:id
 * @description Update a workstream with comprehensive validation and transaction support
 * @access Private (Admin)
 * @param {string} id - Workstream ID
 * @param {string} title - Updated title
 * @param {string} description - Updated description
 * @param {File} image - Optional updated image file
 * @param {string} deadline - Optional updated deadline
 * @returns {Object} Updated workstream data
 */
router.put('/workstreams/:id', (req, res) => {
    // Handle file upload conditionally
    const handleUpload = upload.single('image');
    
    handleUpload(req, res, (err) => {
        // If there's an error and it's about file type, but no file was actually sent, ignore it
        if (err && err.message === 'Only image files are allowed!' && !req.file) {
            // Continue processing without file
        } else if (err) {
            return res.status(400).json({
                success: false,
                error: err.message
            });
        }
        
        // Continue with the actual route logic
    console.log('=== PUT /workstreams/:id ROUTE HIT ===');
    const { id } = req.params;
    const { title, description, deadline } = req.body;
    
    console.log(`Updating workstream with ID: ${id}`);
    console.log('Full req.body:', req.body);
    console.log('Received update request:', { id, title, description, deadline });
    
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
                console.log('PUT: Deadline already in MySQL format:', deadlineValue);
            } else {
                try {
                    const deadlineDate = new Date(deadline);
                    if (isNaN(deadlineDate.getTime())) {
                        console.log('Invalid deadline format:', deadline);
                        return res.status(400).json({ 
                            success: false,
                            error: 'Invalid deadline format. Please use a valid date.' 
                        });
                    }
                    // Convert to MySQL datetime format (YYYY-MM-DD HH:mm:ss)
                    deadlineValue = deadlineDate.toISOString().slice(0, 19).replace('T', ' ');
                    console.log('PUT: Converted deadline to MySQL format:', deadlineValue);
                } catch (err) {
                    console.log('Error parsing deadline:', err);
                    return res.status(400).json({ 
                        success: false,
                        error: 'Invalid deadline format. Please use a valid date.' 
                    });
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
    
    // Complete the WHERE clause
    updateSql += ' WHERE workstream_id = ?';
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
        console.log('Executing SQL:', updateSql, 'with params:', updateParams);
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
            
            // Fetch the updated workstream first
            const fetchWorkstreamSql = 'SELECT workstream_id, title, description, image_type, created_at, is_published, deadline FROM workstreams WHERE workstream_id = ?';
            
            req.db.query(fetchWorkstreamSql, [id], (err, workstreamResults) => {
                if (err) {
                    console.error(`Error fetching updated workstream ${id}:`, err);
                    return req.db.rollback(() => {
                        res.status(500).json({
                            success: false,
                            error: 'Failed to fetch updated workstream. Please refresh the page.'
                        });
                    });
                }
                
                if (workstreamResults.length === 0) {
                    return req.db.rollback(() => {
                        res.status(404).json({
                            success: false,
                            error: 'Workstream not found after update.'
                        });
                    });
                }
                
                const updatedWorkstream = workstreamResults[0];
                console.log('Fetched updated workstream:', updatedWorkstream);
                console.log('Deadline in fetched workstream:', updatedWorkstream.deadline);
                
                // Fetch chapters separately to avoid JSON parsing issues
                const chaptersSql = 'SELECT * FROM module_chapters WHERE workstream_id = ? ORDER BY order_index ASC';
                req.db.query(chaptersSql, [id], (err, chapters) => {
                    if (err) {
                        console.error('Error fetching chapters:', err);
                        return req.db.rollback(() => {
                            res.status(500).json({
                                success: false,
                                error: 'Failed to fetch chapters. Please refresh the page.'
                            });
                        });
                    }
                    
                    // Add chapters to workstream
                    updatedWorkstream.chapters = chapters || [];
                    updatedWorkstream.image_url = updatedWorkstream.image_type ? `/workstreams/${id}/image` : null;
                    
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
                        console.log('Sending response workstream:', responseWorkstream);
                        console.log('Response workstream deadline:', responseWorkstream.deadline);
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
    }); // Close handleUpload callback
});

/**
 * @route PUT /workstreams/:id/publish
 * @description Toggle the published status of a workstream with validation
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
                    // Add timeout to prevent hanging requests
                    const notificationTimeout = setTimeout(() => {
                        console.warn(`⏰ Notification service timeout for workstream ${id}`);
                        res.json({
                            success: true,
                            message: `Workstream published successfully! Email notifications are being sent.`,
                            workstream_id: id,
                            is_published: 1
                        });
                    }, 6000); // 6 second timeout
                    
                    notificationService.notifyNewWorkstream(id)
                        .then((result) => {
                            clearTimeout(notificationTimeout);
                            if (result && result.success) {
                                console.log(`✅ Email notifications initiated for workstream ${id}`);
                                if (!res.headersSent) {
                                    res.json({
                                        success: true,
                                        message: `Workstream published successfully! Email notifications have been sent.`,
                                        workstream_id: id,
                                        is_published: 1
                                    });
                                }
                            } else {
                                console.log(`⚠️ Email notifications failed for workstream ${id}:`, result?.message || 'Unknown error');
                                if (!res.headersSent) {
                                    res.json({
                                        success: true,
                                        message: `Workstream published successfully! However, email notifications could not be sent. Please check the email service configuration.`,
                                        workstream_id: id,
                                        is_published: 1
                                    });
                                }
                            }
                        })
                        .catch(err => {
                            clearTimeout(notificationTimeout);
                            console.error(`❌ Failed to send new workstream notifications for ${id}:`, err);
                            if (!res.headersSent) {
                                res.json({
                                    success: true,
                                    message: `Workstream published successfully! However, email notifications could not be sent. Please check the email service configuration.`,
                                    workstream_id: id,
                                    is_published: 1
                                });
                            }
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

// Get workstream assessments - Used by AssessmentCreate.jsx
router.get('/workstreams/:id/assessments', (req, res) => {
    const { id } = req.params;
    console.log(`Fetching assessments for workstream ID: ${id}`);
    
    const sql = `
        SELECT 
            a.assessment_id,
            a.title,
            a.description,
            a.total_points,
            a.passing_score,
            a.is_final,
            a.deadline,
            a.created_at,
            mc.title as chapter_title,
            mc.chapter_id
        FROM assessments a
        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
        WHERE mc.workstream_id = ?
        ORDER BY a.created_at DESC
    `;
    
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            console.error('Error fetching workstream assessments:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Failed to fetch assessments. Please try again.' 
            });
        }
        
        console.log(`Found ${results.length} assessments for workstream ${id}:`, results);
        // Return assessments array directly to match frontend expectations
        res.json(results);
    });
});

// Create assessment for workstream - Used by AssessmentCreate.jsx
router.post('/workstreams/:id/assessments', (req, res) => {
    const { id: workstreamId } = req.params;
    console.log('Creating assessment for workstream:', workstreamId);
    console.log('Request body:', req.body);
    const { title, description, chapterId, totalPoints, passingScore, deadline, questions } = req.body;
    console.log('Extracted fields:', { title, description, chapterId, totalPoints, passingScore, deadline, questionsCount: questions?.length || 0 });
    
    // Validation
    if (!title || title.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Assessment title is required.'
        });
    }
    
    if (!chapterId) {
        return res.status(400).json({
            success: false,
            error: 'Chapter ID is required.'
        });
    }
    
    // Start transaction
    req.db.beginTransaction(err => {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to start assessment creation. Please try again.'
            });
        }
        
        // Insert assessment
        const insertSql = `
            INSERT INTO assessments (
                chapter_id, 
                title, 
                description, 
                total_points, 
                passing_score, 
                is_final,
                deadline
            ) VALUES (?, ?, ?, ?, ?, FALSE, ?)
        `;
        
        const values = [
            chapterId,
            title.trim(),
            description?.trim() || '',
            totalPoints || 100,
            passingScore || 70,
            deadline || null
        ];
        
        req.db.query(insertSql, values, (err, result) => {
            if (err) {
                console.error('Error creating assessment:', err);
                return req.db.rollback(() => {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to create assessment. Please try again.'
                    });
                });
            }
            
            const assessmentId = result.insertId;
            
            // Create assessment visibility record
            const visibilitySql = 'INSERT INTO assessment_visibility (assessment_id, is_published) VALUES (?, FALSE)';
            
            req.db.query(visibilitySql, [assessmentId], (err) => {
                if (err) {
                    console.error('Error creating assessment visibility:', err);
                    return req.db.rollback(() => {
                        res.status(500).json({
                            success: false,
                            error: 'Failed to create assessment visibility. Please try again.'
                        });
                    });
                }
                
                // Process questions if provided
                if (questions && Array.isArray(questions) && questions.length > 0) {
                    console.log(`Processing ${questions.length} questions for assessment ${assessmentId}`);
                    
                    const processQuestions = async () => {
                        try {
                            for (const question of questions) {
                                const { question: questionText, type, correctAnswer, options } = question;
                                
                                console.log('Backend processing question:', {
                                    questionText: questionText?.substring(0, 50) + '...',
                                    type: type,
                                    correctAnswer: correctAnswer,
                                    options: options
                                });
                                
                                // Map frontend types to database types
                                const questionType = type === 'multiple' ? 'multiple_choice' :
                                                   type === 'truefalse' ? 'true_false' :
                                                   'identification';
                                
                                console.log('Mapped question type:', type, '->', questionType);
                                
                                // Handle options based on question type
                                let optionsString = null;
                                let normalizedCorrectAnswer = correctAnswer;
                                
                                if (questionType === 'multiple_choice') {
                                    // Multiple choice needs options array
                                    if (options && Array.isArray(options) && options.length > 0) {
                                        const cleanOptions = options.filter(opt => opt && opt.toString().trim() !== '');
                                        optionsString = JSON.stringify(cleanOptions);
                                    } else {
                                        optionsString = '[]'; // Fallback empty array
                                    }
                                } else if (questionType === 'true_false') {
                                    // True/False questions don't need options stored (handled by frontend)
                                    optionsString = null;
                                    // Normalize True/False answers to 'True' or 'False' strings
                                    if (typeof correctAnswer === 'boolean') {
                                        normalizedCorrectAnswer = correctAnswer ? 'True' : 'False';
                                    } else if (typeof correctAnswer === 'string') {
                                        const lowerAnswer = correctAnswer.toLowerCase().trim();
                                        if (lowerAnswer === 'true' || lowerAnswer === '1' || lowerAnswer === 'yes' || lowerAnswer === 't') {
                                            normalizedCorrectAnswer = 'True';
                                        } else {
                                            normalizedCorrectAnswer = 'False';
                                        }
                                    } else {
                                        normalizedCorrectAnswer = 'True'; // Default fallback
                                    }
                                } else if (questionType === 'identification') {
                                    // Identification questions don't need options
                                    optionsString = null;
                                }
                                
                                console.log('Normalized correct answer:', correctAnswer, '->', normalizedCorrectAnswer);
                                
                                // Insert question - database trigger will handle True/False normalization
                                const questionSql = 'INSERT INTO questions (assessment_id, question_text, question_type, correct_answer, options) VALUES (?, ?, ?, ?, ?)';
                                
                                console.log('Inserting question into database:', {
                                    assessmentId,
                                    questionText: questionText?.substring(0, 50) + '...',
                                    questionType,
                                    correctAnswer: normalizedCorrectAnswer,
                                    optionsString
                                });
                                
                                const result = await req.db.promise().query(questionSql, [assessmentId, questionText, questionType, normalizedCorrectAnswer, optionsString]);
                                console.log('Question inserted successfully, ID:', result[0].insertId);
                            }
                            
                            // Commit transaction after all questions are processed
                            req.db.commit(err => {
                                if (err) {
                                    console.error('Error committing assessment creation:', err);
                                    return req.db.rollback(() => {
                                        res.status(500).json({
                                            success: false,
                                            error: 'Failed to complete assessment creation. Please try again.'
                                        });
                                    });
                                }
                                
                                console.log(`Successfully created assessment with ID: ${assessmentId} and ${questions.length} questions`);
                                
                                // Send notification for new assessment
                                if (notificationService) {
                                    console.log(`🔔 Attempting to send notifications for assessment ${assessmentId}...`);
                                    
                                    const notificationTimeout = setTimeout(() => {
                                        console.warn(`⏰ Notification service timeout for assessment ${assessmentId}`);
                                        if (!res.headersSent) {
                                            res.status(201).json({
                                                success: true,
                                                message: 'Assessment created successfully! Email notifications are being sent.',
                                                assessment: {
                                                    id: assessmentId,
                                                    title,
                                                    description,
                                                    chapter_id: chapterId,
                                                    total_points: totalPoints || 100,
                                                    passing_score: passingScore || 70,
                                                    deadline,
                                                    questions_count: questions.length
                                                }
                                            });
                                        }
                                    }, 6000);
                                    
                                    notificationService.notifyNewAssessment(assessmentId)
                                        .then((result) => {
                                            clearTimeout(notificationTimeout);
                                            if (result && result.success) {
                                                console.log(`✅ Email notifications initiated for assessment ${assessmentId}`);
                                                if (!res.headersSent) {
                                                    res.status(201).json({
                                                        success: true,
                                                        message: 'Assessment created successfully! Email notifications have been sent.',
                                                        assessment: {
                                                            id: assessmentId,
                                                            title,
                                                            description,
                                                            chapter_id: chapterId,
                                                            total_points: totalPoints || 100,
                                                            passing_score: passingScore || 70,
                                                            deadline,
                                                            questions_count: questions.length
                                                        }
                                                    });
                                                }
                                            } else {
                                                console.log(`⚠️ Email notifications failed for assessment ${assessmentId}:`, result?.message || 'Unknown error');
                                                if (!res.headersSent) {
                                                    res.status(201).json({
                                                        success: true,
                                                        message: 'Assessment created successfully! However, email notifications could not be sent. Please check the email service configuration.',
                                                        assessment: {
                                                            id: assessmentId,
                                                            title,
                                                            description,
                                                            chapter_id: chapterId,
                                                            total_points: totalPoints || 100,
                                                            passing_score: passingScore || 70,
                                                            deadline,
                                                            questions_count: questions.length
                                                        }
                                                    });
                                                }
                                            }
                                        })
                                        .catch(err => {
                                            clearTimeout(notificationTimeout);
                                            console.error(`❌ Failed to send assessment notifications for ${assessmentId}:`, err);
                                            if (!res.headersSent) {
                                                res.status(201).json({
                                                    success: true,
                                                    message: 'Assessment created successfully! However, email notifications could not be sent. Please check the email service configuration.',
                                                    assessment: {
                                                        id: assessmentId,
                                                        title,
                                                        description,
                                                        chapter_id: chapterId,
                                                        total_points: totalPoints || 100,
                                                        passing_score: passingScore || 70,
                                                        deadline,
                                                        questions_count: questions.length
                                                    }
                                                });
                                            }
                                        });
                                } else {
                                    res.status(201).json({
                                        success: true,
                                        message: 'Assessment created successfully! Note: Email notification service is currently unavailable.',
                                        assessment: {
                                            id: assessmentId,
                                            title,
                                            description,
                                            chapter_id: chapterId,
                                            total_points: totalPoints || 100,
                                            passing_score: passingScore || 70,
                                            deadline,
                                            questions_count: questions.length
                                        }
                                    });
                                }
                            });
                        } catch (error) {
                            console.error('Error processing questions:', error);
                            req.db.rollback(() => {
                                res.status(500).json({
                                    success: false,
                                    error: 'Failed to create assessment questions. Please try again.',
                                    details: error.message
                                });
                            });
                        }
                    };
                    
                    processQuestions();
                } else {
                    // No questions provided, just commit the assessment
                    req.db.commit(err => {
                        if (err) {
                            console.error('Error committing assessment creation:', err);
                            return req.db.rollback(() => {
                                res.status(500).json({
                                    success: false,
                                    error: 'Failed to complete assessment creation. Please try again.'
                                });
                            });
                        }
                        
                        console.log(`Successfully created assessment with ID: ${assessmentId} (no questions)`);
                        
                        // Send notification for new assessment with timeout handling
                        if (notificationService) {
                            console.log(`🔔 Attempting to send notifications for assessment ${assessmentId} (no questions)...`);
                            
                            const notificationTimeout = setTimeout(() => {
                                console.warn(`⏰ Notification service timeout for assessment ${assessmentId}`);
                                if (!res.headersSent) {
                                    res.status(201).json({
                                        success: true,
                                        message: 'Assessment created successfully! Email notifications are being sent.',
                                        assessment: {
                                            id: assessmentId,
                                            title,
                                            description,
                                            chapter_id: chapterId,
                                            total_points: totalPoints || 100,
                                            passing_score: passingScore || 70,
                                            deadline
                                        }
                                    });
                                }
                            }, 6000);
                            
                            notificationService.notifyNewAssessment(assessmentId)
                                .then((result) => {
                                    clearTimeout(notificationTimeout);
                                    if (result && result.success) {
                                        console.log(`✅ Email notifications initiated for assessment ${assessmentId}`);
                                        if (!res.headersSent) {
                                            res.status(201).json({
                                                success: true,
                                                message: 'Assessment created successfully! Email notifications have been sent.',
                                                assessment: {
                                                    id: assessmentId,
                                                    title,
                                                    description,
                                                    chapter_id: chapterId,
                                                    total_points: totalPoints || 100,
                                                    passing_score: passingScore || 70,
                                                    deadline
                                                }
                                            });
                                        }
                                    } else {
                                        console.log(`⚠️ Email notifications failed for assessment ${assessmentId}:`, result?.message || 'Unknown error');
                                        if (!res.headersSent) {
                                            res.status(201).json({
                                                success: true,
                                                message: 'Assessment created successfully! However, email notifications could not be sent. Please check the email service configuration.',
                                                assessment: {
                                                    id: assessmentId,
                                                    title,
                                                    description,
                                                    chapter_id: chapterId,
                                                    total_points: totalPoints || 100,
                                                    passing_score: passingScore || 70,
                                                    deadline
                                                }
                                            });
                                        }
                                    }
                                })
                                .catch(err => {
                                    clearTimeout(notificationTimeout);
                                    console.error(`❌ Failed to send assessment notifications for ${assessmentId}:`, err);
                                    if (!res.headersSent) {
                                        res.status(201).json({
                                            success: true,
                                            message: 'Assessment created successfully! However, email notifications could not be sent. Please check the email service configuration.',
                                            assessment: {
                                                id: assessmentId,
                                                title,
                                                description,
                                                chapter_id: chapterId,
                                                total_points: totalPoints || 100,
                                                passing_score: passingScore || 70,
                                                deadline
                                            }
                                        });
                                    }
                                });
                        } else {
                            res.status(201).json({
                                success: true,
                                message: 'Assessment created successfully! Note: Email notification service is currently unavailable.',
                                assessment: {
                                    id: assessmentId,
                                    title,
                                    description,
                                    chapter_id: chapterId,
                                    total_points: totalPoints || 100,
                                    passing_score: passingScore || 70,
                                    deadline
                                }
                            });
                        }
                    });
                }
            });
        });
    });
});

// Image route moved to server.js as public route (no authentication required)

export default router;
