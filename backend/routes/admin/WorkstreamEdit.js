import express from 'express';
import multer from 'multer';

const router = express.Router();

// Multer configuration for handling image uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Read a single workstream (including image) - Used by WorkstreamEdit.jsx
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

// Update a workstream and return the complete, updated object - Used by WorkstreamEdit.jsx
router.put('/workstreams/:id', upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { title, description, deadline } = req.body;
    
    console.log('Received update request:', { id, title, description, deadline }); // Debug log
    
    // Validate deadline format if provided
    let deadlineValue = null;
    if (deadline !== undefined) {
        if (deadline === null || deadline === '') {
            deadlineValue = null; // Allow clearing the deadline
        } else {
            const deadlineDate = new Date(deadline);
            if (isNaN(deadlineDate.getTime())) {
                console.log('Invalid deadline format:', deadline); // Debug log
                return res.status(400).json({ error: 'Invalid deadline format. Please use a valid date.' });
            }
            // Convert to MySQL datetime format (YYYY-MM-DD HH:mm:ss)
            deadlineValue = deadlineDate.toISOString().slice(0, 19).replace('T', ' ');
            console.log('Parsed deadline for MySQL:', deadlineValue); // Debug log
        }
    }

    // 1. Update the workstream
    let updateSql = 'UPDATE workstreams SET title = ?, description = ?';
    const updateParams = [title, description];

    if (deadline !== undefined) {
        updateSql += ', deadline = ?';
        updateParams.push(deadlineValue);
    }

    if (req.file) {
        updateSql += ', image = ?, image_type = ?';
        updateParams.push(req.file.buffer);
        updateParams.push(req.file.mimetype);
    }
    updateSql += ' WHERE workstream_id = ?';
    updateParams.push(id);

    console.log('Executing SQL:', updateSql, 'with params:', updateParams); // Debug log

    req.db.query(updateSql, updateParams, (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Failed to update workstream: ${err.message}` });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Workstream not found for update.' });
        }

        // 2. Fetch and return the complete workstream data
        const workstreamSql = 'SELECT workstream_id, title, description, image_type, created_at, is_published, deadline FROM workstreams WHERE workstream_id = ?';
        req.db.query(workstreamSql, [id], (err, workstreamResults) => {
            if (err) return res.status(500).json({ error: `Failed to fetch workstream after update: ${err.message}` });
            if (workstreamResults.length === 0) return res.status(404).json({ error: 'Workstream not found after update.' });

            const workstream = workstreamResults[0];
            console.log('Fetched updated workstream:', workstream); // Debug log
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

export default router;
