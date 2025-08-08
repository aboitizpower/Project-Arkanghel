import express from 'express';
import multer from 'multer';

const router = express.Router();

// Multer configuration for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Get a single chapter - Used by ChapterEdit.jsx
router.get('/chapters/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM module_chapters WHERE chapter_id = ?';
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        res.json(results[0]);
    });
});

// Update a chapter - Used by ChapterEdit.jsx
router.put('/chapters/:id', upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'pdf', maxCount: 1 }
]), (req, res) => {
    const { id } = req.params;
    const { title, content, order_index } = req.body;
    
    if (!title || !content || order_index === undefined) {
        return res.status(400).json({ error: 'title, content, and order_index are required.' });
    }

    let updateSql = 'UPDATE module_chapters SET title = ?, content = ?, order_index = ?';
    const updateParams = [title, content, order_index];

    // Handle video upload
    if (req.files?.video?.[0]) {
        updateSql += ', video = ?, video_filename = ?, video_mime_type = ?';
        updateParams.push(req.files.video[0].buffer);
        updateParams.push(req.files.video[0].originalname);
        updateParams.push(req.files.video[0].mimetype);
    }

    // Handle PDF upload
    if (req.files?.pdf?.[0]) {
        updateSql += ', pdf = ?, pdf_filename = ?, pdf_mime_type = ?';
        updateParams.push(req.files.pdf[0].buffer);
        updateParams.push(req.files.pdf[0].originalname);
        updateParams.push(req.files.pdf[0].mimetype);
    }

    updateSql += ' WHERE chapter_id = ?';
    updateParams.push(id);

    req.db.query(updateSql, updateParams, (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        res.json({ success: 'Chapter updated successfully!' });
    });
});

// Update chapter video - Used by ChapterEdit.jsx
router.put('/chapters/:id/video', upload.single('video'), (req, res) => {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'No video file uploaded.' });
    }

    const video = req.file.buffer;
    const video_type = req.file.mimetype;

    const sql = 'UPDATE module_chapters SET video = ?, video_type = ? WHERE chapter_id = ?';
    req.db.query(sql, [video, video_type, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Failed to update video: ${err.message}` });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        res.json({ success: 'Video updated successfully!' });
    });
});

// Update chapter PDF - Used by ChapterEdit.jsx
router.put('/chapters/:id/pdf', upload.single('pdf'), (req, res) => {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded.' });
    }

    const pdf = req.file.buffer;
    const pdf_type = req.file.mimetype;

    const sql = 'UPDATE module_chapters SET pdf = ?, pdf_type = ? WHERE chapter_id = ?';
    req.db.query(sql, [pdf, pdf_type, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Failed to update PDF: ${err.message}` });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        res.json({ success: 'PDF updated successfully!' });
    });
});

// Update chapter publish status - Used by ChapterEdit.jsx
router.put('/chapters/:id/publish', (req, res) => {
    const { id } = req.params;
    const { is_published } = req.body;

    if (typeof is_published !== 'boolean') {
        return res.status(400).json({ error: 'Invalid is_published value. It must be a boolean.' });
    }

    const sql = 'UPDATE module_chapters SET is_published = ? WHERE chapter_id = ?';
    req.db.query(sql, [is_published, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to update chapter publish state.', details: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        res.json({ success: true, message: 'Chapter publish state updated successfully.' });
    });
});

// Get chapter video - Used by ChapterEdit.jsx
router.get('/chapters/:id/video', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT video, video_mime_type FROM module_chapters WHERE chapter_id = ?';
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0 || !results[0].video) {
            return res.status(404).json({ error: 'Video not found.' });
        }
        const { video, video_mime_type } = results[0];
        res.setHeader('Content-Type', video_mime_type);
        res.send(video);
    });
});

// Get chapter PDF - Used by ChapterEdit.jsx
router.get('/chapters/:id/pdf', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT pdf, pdf_mime_type FROM module_chapters WHERE chapter_id = ?';
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0 || !results[0].pdf) {
            return res.status(404).json({ error: 'PDF not found.' });
        }
        const { pdf, pdf_mime_type } = results[0];
        res.setHeader('Content-Type', pdf_mime_type);
        res.send(pdf);
    });
});

export default router;
