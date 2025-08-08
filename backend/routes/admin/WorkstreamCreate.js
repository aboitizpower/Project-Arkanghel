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

export default router;
