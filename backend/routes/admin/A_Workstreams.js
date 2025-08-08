import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

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
    console.log('Fetching all workstreams');
    
    const sql = `
        SELECT 
            w.workstream_id as id,
            w.title, 
            w.description, 
            w.image_type,
            w.created_at, 
            w.is_published,
            (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id) as chapters_count,
            (SELECT COUNT(*) FROM module_chapters mc 
             WHERE mc.workstream_id = w.workstream_id 
             AND mc.is_published = TRUE 
             AND mc.title NOT LIKE '%Final Assessment%') as published_chapters_count,
            (SELECT COUNT(DISTINCT a.assessment_id) 
             FROM assessments a
             JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
             WHERE mc.workstream_id = w.workstream_id) as assessments_count
        FROM workstreams w
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
            const chapterIds = chapters.map(ch => ch.id);
            const assessmentsSql = `
                SELECT 
                    assessment_id as id,
                    chapter_id,
                    title,
                    description,
                    passing_score,
                    total_points,
                    time_limit_minutes,
                    is_published,
                    created_at
                FROM assessments 
                WHERE chapter_id IN (?)
                ORDER BY created_at ASC
            `;
            
            req.db.query(assessmentsSql, [chapterIds], (err, assessments) => {
                if (err) {
                    console.error(`Error fetching assessments for workstream ${id}:`, err);
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to fetch assessments. Please try again later.'
                    });
                }
                
                // Group assessments by chapter_id
                const assessmentsByChapter = assessments.reduce((acc, assessment) => {
                    (acc[assessment.chapter_id] = acc[assessment.chapter_id] || []).push(assessment);
                    return acc;
                }, {});
                
                // Add assessments to their respective chapters
                const chaptersWithAssessments = chapters.map(chapter => ({
                    ...chapter,
                    assessments: assessmentsByChapter[chapter.id] || []
                }));
                
                console.log(`Fetched workstream ${id} with ${chapters.length} chapters`);
                res.json({
                    success: true,
                    workstream: {
                        ...workstream,
                        chapters: chaptersWithAssessments,
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
    console.log('Creating new workstream');
    const { title, description } = req.body;
    
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
            (title, description, image, image_type, created_at, updated_at)
            VALUES (?, ?, ?, ?, NOW(), NOW())
        `;
        
        req.db.query(workstreamSql, [title, description, image, image_type], (err, result) => {
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
                            message: 'Workstream created successfully!',
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
    const { id } = req.params;
    const { title, description } = req.body;
    
    console.log(`Updating workstream with ID: ${id}`);
    
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
    
    // Build the update query dynamically based on provided fields
    let updateSql = 'UPDATE workstreams SET title = ?, description = ?';
    const updateParams = [title, description];
    
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
                    res.json({
                        success: true,
                        message: 'Workstream updated successfully!',
                        workstream: {
                            ...updatedWorkstream,
                            image_url: updatedWorkstream.image_type ? `/workstreams/${id}/image` : null
                        }
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
        const updateSql = 'UPDATE workstreams SET is_published = ?, updated_at = NOW() WHERE workstream_id = ?';
        
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
            res.json({
                success: true,
                message: `Workstream ${is_published ? 'published' : 'unpublished'} successfully!`,
                workstream_id: id,
                is_published: is_published ? 1 : 0
            });
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

export default router;
