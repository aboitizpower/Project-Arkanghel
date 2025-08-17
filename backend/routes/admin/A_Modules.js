import express from 'express';
import multer from 'multer';

const router = express.Router();

// Multer configuration for handling image uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Create a new workstream - Used by WorkstreamCreate.jsx
router.post('/workstreams', upload.single('image'), (req, res) => {
    const { title, description } = req.body;
    const image = req.file ? req.file.buffer : null;
    const image_type = req.file ? req.file.mimetype : null;

    if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required.' });
    }

    const sql = 'INSERT INTO workstreams (title, description, image, image_type) VALUES (?, ?, ?, ?)';
    req.db.query(sql, [title, description, image, image_type], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ success: 'Workstream created successfully!', workstream_id: result.insertId });
    });
});

// Read all workstreams (for admin) - Used by A_Modules.jsx
router.get('/workstreams', (req, res) => {
    const sql = `
        SELECT 
            w.workstream_id, 
            w.title, 
            w.description, 
            w.image_type, 
            w.created_at, 
            w.is_published,
            (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id) AS chapters_count,
            (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE AND mc.title NOT LIKE '%Final Assessment%') as regular_chapters_count,
            (
                SELECT COUNT(DISTINCT a.assessment_id) 
                FROM assessments a
                JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE
            ) as assessments_count,
            (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE AND mc.title LIKE '%Final Assessment%') > 0 as has_final_assessment
        FROM workstreams w
    `;
    req.db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
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
    const workstreamSql = 'SELECT workstream_id, title, description, image_type, created_at, is_published FROM workstreams WHERE workstream_id = ?';
    req.db.query(workstreamSql, [id], (err, workstreamResults) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (workstreamResults.length === 0) {
            return res.status(404).json({ error: 'Workstream not found.' });
        }
        
        const workstream = workstreamResults[0];
        
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
                return res.json({
                    ...workstream,
                    chapters: [],
                    image_url: workstream.image_type ? `/workstreams/${id}/image` : null
                });
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
                
                res.json({
                    ...workstream,
                    chapters: chaptersWithAssessments,
                    image_url: workstream.image_type ? `/workstreams/${id}/image` : null
                });
            });
        });
    });
});

// Update a workstream and return the complete, updated object
router.put('/workstreams/:id', upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;

    // 1. Update the workstream
    let updateSql = 'UPDATE workstreams SET title = ?, description = ?';
    const updateParams = [title, description];

    if (req.file) {
        updateSql += ', image = ?, image_type = ?';
        updateParams.push(req.file.buffer);
        updateParams.push(req.file.mimetype);
    }
    updateSql += ' WHERE workstream_id = ?';
    updateParams.push(id);

    req.db.query(updateSql, updateParams, (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Failed to update workstream: ${err.message}` });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Workstream not found for update.' });
        }

        // 2. Fetch and return the complete workstream data (mimicking the /complete endpoint)
        const workstreamSql = 'SELECT workstream_id, title, description, image_type, created_at, is_published FROM workstreams WHERE workstream_id = ?';
        req.db.query(workstreamSql, [id], (err, workstreamResults) => {
            if (err) return res.status(500).json({ error: `Failed to fetch workstream after update: ${err.message}` });
            if (workstreamResults.length === 0) return res.status(404).json({ error: 'Workstream not found after update.' });

            const workstream = workstreamResults[0];
            const chaptersSql = 'SELECT * FROM module_chapters WHERE workstream_id = ? ORDER BY order_index ASC';

            req.db.query(chaptersSql, [id], (err, chapters) => {
                if (err) return res.status(500).json({ error: `Failed to fetch chapters after update: ${err.message}` });

                const chapterIds = chapters.map(ch => ch.chapter_id);
                if (chapterIds.length === 0) {
                    return res.json({ ...workstream, chapters: [], image_url: workstream.image_type ? `/workstreams/${id}/image` : null });
                }

                const assessmentsSql = 'SELECT * FROM assessments WHERE chapter_id IN (?)';
                req.db.query(assessmentsSql, [chapterIds], (err, assessments) => {
                    if (err) return res.status(500).json({ error: `Failed to fetch assessments after update: ${err.message}` });

                    const assessmentsByChapter = assessments.reduce((acc, assessment) => {
                        (acc[assessment.chapter_id] = acc[assessment.chapter_id] || []).push(assessment);
                        return acc;
                    }, {});

                    const chaptersWithAssessments = chapters.map(chapter => ({
                        ...chapter,
                        assessments: assessmentsByChapter[chapter.chapter_id] || []
                    }));

                    res.json({
                        ...workstream,
                        chapters: chaptersWithAssessments,
                        image_url: workstream.image_type ? `/workstreams/${id}/image` : null
                    });
                });
            });
        });
    });
});

// Get a workstream's image
router.get('/workstreams/:id/image', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT image, image_type FROM workstreams WHERE workstream_id = ?';
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0 || !results[0].image) {
            return res.status(404).json({ error: 'Image not found.' });
        }
        const { image, image_type } = results[0];
        res.setHeader('Content-Type', image_type);
        res.send(image);
    });
});

// Delete a workstream and all its related data manually within a transaction
router.delete('/workstreams/:id', async (req, res) => {
    const workstreamId = req.params.id;
    if (!workstreamId) {
        return res.status(400).json({ error: 'Workstream ID is required.' });
    }

    const connection = req.db;

    try {
        // Start a transaction
        await connection.promise().beginTransaction();
        console.log(`Transaction started for deleting workstream ${workstreamId}.`);

        // 1. Get all chapter_ids for the workstream
        const [chapters] = await connection.promise().query('SELECT chapter_id FROM module_chapters WHERE workstream_id = ?', [workstreamId]);
        const chapterIds = chapters.map(c => c.chapter_id);
        console.log(`Found chapter IDs: ${chapterIds.join(', ')}`);

        if (chapterIds.length > 0) {
            // 2. Get all assessment_ids for these chapters
            const [assessments] = await connection.promise().query('SELECT assessment_id FROM assessments WHERE chapter_id IN (?)', [chapterIds]);
            const assessmentIds = assessments.map(a => a.assessment_id);
            console.log(`Found assessment IDs: ${assessmentIds.join(', ')}`);

            if (assessmentIds.length > 0) {
                // Get all question_ids for these assessments
                const [questions] = await connection.promise().query('SELECT question_id FROM questions WHERE assessment_id IN (?)', [assessmentIds]);
                const questionIds = questions.map(q => q.question_id);

                if (questionIds.length > 0) {
                    // Delete answers associated with these questions first
                    await connection.promise().query('DELETE FROM answers WHERE question_id IN (?)', [questionIds]);
                }

                // Delete questions for these assessments
                await connection.promise().query('DELETE FROM questions WHERE assessment_id IN (?)', [assessmentIds]);
            }

            // 6. Delete user progress for these chapters
            console.log('Deleting user progress...');
            await connection.promise().query('DELETE FROM user_progress WHERE chapter_id IN (?)', [chapterIds]);

            // 7. Delete assessments for these chapters
            console.log('Deleting assessments...');
            await connection.promise().query('DELETE FROM assessments WHERE chapter_id IN (?)', [chapterIds]);
        }

        // 8. Delete chapters for the workstream
        console.log('Deleting module chapters...');
        await connection.promise().query('DELETE FROM module_chapters WHERE workstream_id = ?', [workstreamId]);

        // 9. Finally, delete the workstream itself
        console.log('Deleting workstream...');
        const [result] = await connection.promise().query('DELETE FROM workstreams WHERE workstream_id = ?', [workstreamId]);

        if (result.affectedRows === 0) {
            // If the workstream was not found, rollback and send an error
            await connection.promise().rollback();
            return res.status(404).json({ error: 'Workstream not found.' });
        }

        // Commit the transaction
        await connection.promise().commit();
        console.log(`Transaction committed for workstream ${workstreamId}.`);

        res.json({ success: 'Workstream and all associated data deleted successfully.' });

    } catch (err) {
        // If any error occurs, rollback the transaction
        console.error(`Error during deletion transaction for workstream ${workstreamId}:`, err);
        await connection.promise().rollback();
        console.log('Transaction rolled back.');
        res.status(500).json({ error: `Database error during deletion: ${err.message}` });
    }
});

export default router;
