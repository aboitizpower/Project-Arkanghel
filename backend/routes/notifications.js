import express from 'express';
import notificationService from '../services/notificationService.js';
import emailService from '../services/emailService.js';

const router = express.Router();

// Trigger notification for new workstream
router.post('/workstream/new/:workstreamId', async (req, res) => {
    try {
        const { workstreamId } = req.params;
        await notificationService.notifyNewWorkstream(workstreamId);
        res.json({ success: true, message: 'New workstream notifications sent' });
    } catch (error) {
        console.error('Error sending new workstream notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Trigger notification for new chapter
router.post('/chapter/new/:chapterId', async (req, res) => {
    try {
        const { chapterId } = req.params;
        await notificationService.notifyNewChapter(chapterId);
        res.json({ success: true, message: 'New chapter notifications sent' });
    } catch (error) {
        console.error('Error sending new chapter notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Trigger notification for new assessment
router.post('/assessment/new/:assessmentId', async (req, res) => {
    try {
        const { assessmentId } = req.params;
        await notificationService.notifyNewAssessment(assessmentId);
        res.json({ success: true, message: 'New assessment notifications sent' });
    } catch (error) {
        console.error('Error sending new assessment notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Trigger notification for completion
router.post('/completion', async (req, res) => {
    try {
        const { userId, workstreamId } = req.body;
        await notificationService.notifyCompletion(userId, workstreamId);
        res.json({ success: true, message: 'Completion notification sent' });
    } catch (error) {
        console.error('Error sending completion notification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Trigger notification for updates
router.post('/update', async (req, res) => {
    try {
        const { targetId, targetType, changes } = req.body;
        await notificationService.notifyUpdate(targetId, targetType, changes);
        res.json({ success: true, message: 'Update notifications sent' });
    } catch (error) {
        console.error('Error sending update notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Schedule a future notification
router.post('/schedule', async (req, res) => {
    try {
        const { type, targetId, targetType, triggerTime, data } = req.body;
        const scheduleId = await notificationService.scheduleNotification(
            type, targetId, targetType, triggerTime, data
        );
        res.json({ success: true, scheduleId, message: 'Notification scheduled successfully' });
    } catch (error) {
        console.error('Error scheduling notification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Manually trigger deadline reminders check
router.post('/check/deadlines', async (req, res) => {
    try {
        await notificationService.checkDeadlineReminders();
        res.json({ success: true, message: 'Deadline reminders check completed' });
    } catch (error) {
        console.error('Error checking deadline reminders:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Manually trigger overdue check
router.post('/check/overdue', async (req, res) => {
    try {
        await notificationService.checkOverdueItems();
        res.json({ success: true, message: 'Overdue items check completed' });
    } catch (error) {
        console.error('Error checking overdue items:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get notification logs
router.get('/logs', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const connection = await emailService.getConnection();
        try {
            const [logs] = await connection.execute(
                `SELECT notification_id, type, target_id, target_type, recipient_email, 
                        subject, status, sent_at, created_at 
                 FROM notifications_log 
                 ORDER BY created_at DESC 
                 LIMIT ?`,
                [parseInt(limit)]
            );
            
            res.json({
                success: true,
                logs
            });
        } finally {
            await connection.end();
        }
    } catch (error) {
        console.error('Error fetching notification logs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get notification statistics
router.get('/stats', async (req, res) => {
    try {
        const connection = await emailService.getConnection();
        try {
            const [stats] = await connection.execute(`
                SELECT 
                    COUNT(*) as total_notifications,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                    COUNT(DISTINCT recipient_email) as unique_recipients,
                    COUNT(DISTINCT type) as notification_types
                FROM notifications_log
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            `);
            
            const [typeStats] = await connection.execute(`
                SELECT type, COUNT(*) as count 
                FROM notifications_log 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY type 
                ORDER BY count DESC
            `);
            
            res.json({
                success: true,
                stats: stats[0],
                typeBreakdown: typeStats
            });
        } finally {
            await connection.end();
        }
    } catch (error) {
        console.error('Error fetching notification stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test email configuration
router.post('/test', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email address required' });
        }
        
        const testData = {
            title: 'Test Notification',
            description: 'This is a test notification to verify email configuration.',
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        };
        
        await emailService.sendToSpecificUser(
            'new_workstream',
            testData,
            'test-id',
            'workstream',
            email,
            'Test User'
        );
        
        res.json({ success: true, message: 'Test email sent successfully' });
    } catch (error) {
        console.error('Error sending test email:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
