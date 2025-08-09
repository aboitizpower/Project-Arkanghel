import express from 'express';
import multer from 'multer';

const router = express.Router();

// Multer configuration for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Create a new chapter - Used by ChapterCreate.jsx
router.post('/chapters', upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'pdf', maxCount: 1 }
]), (req, res) => {
    const { workstream_id, title, content } = req.body;
    
    if (!workstream_id || !title || !content) {
        return res.status(400).json({ error: 'workstream_id, title, and content are required.' });
    }

    const video = req.files?.video?.[0]?.buffer || null;
    const video_filename = req.files?.video?.[0]?.originalname || null;
    const video_mime_type = req.files?.video?.[0]?.mimetype || null;
    
    const pdf = req.files?.pdf?.[0]?.buffer || null;
    const pdf_filename = req.files?.pdf?.[0]?.originalname || null;
    const pdf_mime_type = req.files?.pdf?.[0]?.mimetype || null;

    // Get the next order_index automatically
    const getMaxOrderSql = 'SELECT COALESCE(MAX(order_index), -1) + 1 as next_order FROM module_chapters WHERE workstream_id = ?';
    
    req.db.query(getMaxOrderSql, [workstream_id], (err, orderResults) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to determine chapter order: ' + err.message });
        }
        
        const next_order = orderResults[0].next_order;

        const sql = `
            INSERT INTO module_chapters 
            (workstream_id, title, content, order_index, video_file, video_filename, video_mime_type, pdf_file, pdf_filename, pdf_mime_type) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        req.db.query(sql, [
            workstream_id, title, content, next_order,
            video, video_filename, video_mime_type,
            pdf, pdf_filename, pdf_mime_type
        ], (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ 
                success: 'Chapter created successfully!', 
                chapter_id: result.insertId 
            });
        });
    });
});

export default router;
