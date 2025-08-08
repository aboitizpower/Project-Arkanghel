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

        // 2. Fetch and return the complete workstream data
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

export default router;
