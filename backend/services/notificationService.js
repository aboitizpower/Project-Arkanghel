import cron from 'node-cron';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import emailService from './emailService.js';
import dotenv from 'dotenv';

dotenv.config();

class NotificationService {
    constructor() {
        this.dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        };
        
        this.isRunning = false;
        this.scheduledJobs = new Map();
    }

    async getConnection() {
        return await mysql.createConnection(this.dbConfig);
    }

    // Initialize the notification service and start scheduled jobs
    async initialize() {
        if (this.isRunning) return;
        
        console.log('🔔 Initializing Notification Service...');
        
        // Schedule daily checks for deadline reminders and overdue items
        this.scheduledJobs.set('daily-check', cron.schedule('0 9 * * *', async () => {
            console.log('🕘 Running daily notification check...');
            await this.checkDeadlineReminders();
            await this.checkOverdueItems();
        }, { scheduled: false }));

        // Schedule hourly checks for immediate notifications
        this.scheduledJobs.set('hourly-check', cron.schedule('0 * * * *', async () => {
            await this.processScheduledNotifications();
        }, { scheduled: false }));

        // Start all scheduled jobs
        this.scheduledJobs.forEach(job => job.start());
        this.isRunning = true;
        
        console.log('✅ Notification Service initialized successfully');
    }

    // Stop all scheduled jobs
    stop() {
        this.scheduledJobs.forEach(job => job.stop());
        this.isRunning = false;
        console.log('🛑 Notification Service stopped');
    }

    // Schedule a notification for future delivery
    async scheduleNotification(type, targetId, targetType, triggerTime, data) {
        const connection = await this.getConnection();
        try {
            const scheduleId = uuidv4();
            await connection.execute(
                `INSERT INTO notification_schedules 
                (schedule_id, notification_type, target_id, target_type, trigger_time, data, status) 
                VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
                [scheduleId, type, targetId, targetType, triggerTime, JSON.stringify(data)]
            );
            return scheduleId;
        } finally {
            await connection.end();
        }
    }

    // Process scheduled notifications that are due
    async processScheduledNotifications() {
        const connection = await this.getConnection();
        try {
            const [notifications] = await connection.execute(
                `SELECT * FROM notification_schedules 
                WHERE status = 'pending' AND trigger_time <= NOW() 
                ORDER BY trigger_time ASC LIMIT 50`
            );

            for (const notification of notifications) {
                try {
                    // Mark as processing
                    await connection.execute(
                        'UPDATE notification_schedules SET status = "processing" WHERE schedule_id = ?',
                        [notification.schedule_id]
                    );

                    const data = JSON.parse(notification.data);
                    await emailService.sendNotification(
                        notification.notification_type,
                        data,
                        notification.target_id,
                        notification.target_type
                    );

                    // Mark as completed
                    await connection.execute(
                        'UPDATE notification_schedules SET status = "completed", last_run = NOW() WHERE schedule_id = ?',
                        [notification.schedule_id]
                    );

                } catch (error) {
                    console.error(`Failed to process scheduled notification ${notification.schedule_id}:`, error);
                    await connection.execute(
                        'UPDATE notification_schedules SET status = "failed", error_message = ? WHERE schedule_id = ?',
                        [error.message, notification.schedule_id]
                    );
                }
            }
        } finally {
            await connection.end();
        }
    }

    // Check for deadline reminders (1 week and 1 day before)
    async checkDeadlineReminders() {
        const connection = await this.getConnection();
        try {
            // Check workstreams for 1-week reminders
            const [workstreamsWeek] = await connection.execute(`
                SELECT w.*, 'workstream' as type 
                FROM workstreams w 
                WHERE w.deadline BETWEEN DATE_ADD(NOW(), INTERVAL 6 DAY) AND DATE_ADD(NOW(), INTERVAL 8 DAY)
                AND w.is_published = 1
            `);

            // Check workstreams for 1-day reminders
            const [workstreamsDay] = await connection.execute(`
                SELECT w.*, 'workstream' as type 
                FROM workstreams w 
                WHERE w.deadline BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 DAY)
                AND w.is_published = 1
            `);

            // Check chapters for 1-week reminders
            const [chaptersWeek] = await connection.execute(`
                SELECT c.*, w.title as workstream_title, 'chapter' as type 
                FROM module_chapters c 
                JOIN workstreams w ON c.workstream_id = w.workstream_id
                WHERE c.deadline BETWEEN DATE_ADD(NOW(), INTERVAL 6 DAY) AND DATE_ADD(NOW(), INTERVAL 8 DAY)
                AND c.is_published = 1
            `);

            // Check chapters for 1-day reminders
            const [chaptersDay] = await connection.execute(`
                SELECT c.*, w.title as workstream_title, 'chapter' as type 
                FROM module_chapters c 
                JOIN workstreams w ON c.workstream_id = w.workstream_id
                WHERE c.deadline BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 DAY)
                AND c.is_published = 1
            `);

            // Check assessments for 1-week reminders
            const [assessmentsWeek] = await connection.execute(`
                SELECT a.*, 
                       COALESCE(w.title, c.title) as connected_title,
                       'assessment' as type 
                FROM assessments a 
                LEFT JOIN workstreams w ON a.workstream_id = w.workstream_id
                LEFT JOIN module_chapters c ON a.chapter_id = c.chapter_id
                WHERE a.deadline BETWEEN DATE_ADD(NOW(), INTERVAL 6 DAY) AND DATE_ADD(NOW(), INTERVAL 8 DAY)
                AND a.is_published = 1
            `);

            // Check assessments for 1-day reminders
            const [assessmentsDay] = await connection.execute(`
                SELECT a.*, 
                       COALESCE(w.title, c.title) as connected_title,
                       'assessment' as type 
                FROM assessments a 
                LEFT JOIN workstreams w ON a.workstream_id = w.workstream_id
                LEFT JOIN module_chapters c ON a.chapter_id = c.chapter_id
                WHERE a.deadline BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 DAY)
                AND a.is_published = 1
            `);

            // Send 1-week reminders
            const weekItems = [...workstreamsWeek, ...chaptersWeek, ...assessmentsWeek];
            for (const item of weekItems) {
                await this.sendDeadlineReminder(item, 'week');
            }

            // Send 1-day reminders
            const dayItems = [...workstreamsDay, ...chaptersDay, ...assessmentsDay];
            for (const item of dayItems) {
                await this.sendDeadlineReminder(item, 'day');
            }

            console.log(`📅 Processed ${weekItems.length} week reminders and ${dayItems.length} day reminders`);

        } finally {
            await connection.end();
        }
    }

    // Check for overdue items
    async checkOverdueItems() {
        const connection = await this.getConnection();
        try {
            // Check overdue workstreams
            const [overdueWorkstreams] = await connection.execute(`
                SELECT w.*, 
                       DATEDIFF(NOW(), w.deadline) as days_overdue,
                       'workstream' as type 
                FROM workstreams w 
                WHERE w.deadline < NOW() 
                AND w.is_published = 1
                AND DATEDIFF(NOW(), w.deadline) <= 30
            `);

            // Check overdue chapters
            const [overdueChapters] = await connection.execute(`
                SELECT c.*, 
                       w.title as workstream_title,
                       DATEDIFF(NOW(), c.deadline) as days_overdue,
                       'chapter' as type 
                FROM module_chapters c 
                JOIN workstreams w ON c.workstream_id = w.workstream_id
                WHERE c.deadline < NOW() 
                AND c.is_published = 1
                AND DATEDIFF(NOW(), c.deadline) <= 30
            `);

            // Check overdue assessments
            const [overdueAssessments] = await connection.execute(`
                SELECT a.*, 
                       COALESCE(w.title, c.title) as connected_title,
                       DATEDIFF(NOW(), a.deadline) as days_overdue,
                       'assessment' as type 
                FROM assessments a 
                LEFT JOIN workstreams w ON a.workstream_id = w.workstream_id
                LEFT JOIN module_chapters c ON a.chapter_id = c.chapter_id
                WHERE a.deadline < NOW() 
                AND a.is_published = 1
                AND DATEDIFF(NOW(), a.deadline) <= 30
            `);

            // Send overdue notifications
            const overdueItems = [...overdueWorkstreams, ...overdueChapters, ...overdueAssessments];
            for (const item of overdueItems) {
                await this.sendOverdueNotification(item);
            }

            console.log(`⚠️ Processed ${overdueItems.length} overdue notifications`);

        } finally {
            await connection.end();
        }
    }

    async sendDeadlineReminder(item, period) {
        const data = {
            id: item.workstream_id || item.chapter_id || item.assessment_id,
            title: item.title,
            deadline: item.deadline,
            type: item.type
        };

        const type = period === 'week' ? 'deadline_reminder_week' : 'deadline_reminder_day';
        const targetId = data.id;
        const targetType = item.type;

        await emailService.sendNotification(type, data, targetId, targetType);
    }

    async sendOverdueNotification(item) {
        const data = {
            id: item.workstream_id || item.chapter_id || item.assessment_id,
            title: item.title,
            deadline: item.deadline,
            daysOverdue: item.days_overdue,
            type: item.type
        };

        await emailService.sendNotification('overdue', data, data.id, item.type);
    }

    // Trigger notifications for new items
    async notifyNewWorkstream(workstreamId) {
        console.log(`🔍 NotificationService: Looking for workstream ${workstreamId}`);
        const connection = await this.getConnection();
        try {
            const [workstreams] = await connection.execute(
                'SELECT * FROM workstreams WHERE workstream_id = ?',
                [workstreamId]
            );

            console.log(`📊 Found ${workstreams.length} workstreams with ID ${workstreamId}`);

            if (workstreams.length > 0) {
                const workstream = workstreams[0];
                console.log(`📝 Workstream details: ${workstream.title}`);
                
                const data = {
                    workstream_id: workstream.workstream_id,
                    title: workstream.title,
                    description: workstream.description,
                    deadline: workstream.deadline
                };

                console.log(`📧 Calling emailService.sendNotification...`);
                const results = await emailService.sendNotification('new_workstream', data, workstreamId, 'workstream');
                console.log(`✅ Email results:`, results);
                console.log(`📧 Sent new workstream notifications for: ${workstream.title}`);
            } else {
                console.log(`⚠️ No workstream found with ID ${workstreamId}`);
            }
        } catch (error) {
            console.error(`❌ Error in notifyNewWorkstream:`, error);
            throw error;
        } finally {
            await connection.end();
        }
    }

    async notifyNewChapter(chapterId) {
        const connection = await this.getConnection();
        try {
            const [chapters] = await connection.execute(`
                SELECT c.*, w.title as workstream_title 
                FROM chapters c 
                JOIN workstreams w ON c.workstream_id = w.workstream_id 
                WHERE c.chapter_id = ?
            `, [chapterId]);

            if (chapters.length > 0) {
                const chapter = chapters[0];
                const data = {
                    chapter_id: chapter.chapter_id,
                    workstream_id: chapter.workstream_id,
                    chapter_title: chapter.title,
                    workstream_title: chapter.workstream_title,
                    description: chapter.description,
                    deadline: chapter.deadline
                };

                await emailService.sendNotification('new_chapter', data, chapterId, 'chapter');
                console.log(`📧 Sent new chapter notifications for: ${chapter.title}`);
            }
        } finally {
            await connection.end();
        }
    }

    async notifyNewAssessment(assessmentId) {
        const connection = await this.getConnection();
        try {
            const [assessments] = await connection.execute(`
                SELECT a.*, 
                       COALESCE(w.title, c.title) as connected_title
                FROM assessments a 
                LEFT JOIN workstreams w ON a.workstream_id = w.workstream_id
                LEFT JOIN chapters c ON a.chapter_id = c.chapter_id
                WHERE a.assessment_id = ?
            `, [assessmentId]);

            if (assessments.length > 0) {
                const assessment = assessments[0];
                const data = {
                    assessment_id: assessment.assessment_id,
                    title: assessment.title,
                    connected_title: assessment.connected_title,
                    deadline: assessment.deadline
                };

                await emailService.sendNotification('new_assessment', data, assessmentId, 'assessment');
                console.log(`📧 Sent new assessment notifications for: ${assessment.title}`);
            }
        } finally {
            await connection.end();
        }
    }

    async notifyCompletion(userId, workstreamId) {
        const connection = await this.getConnection();
        try {
            const [workstreams] = await connection.execute(
                'SELECT * FROM workstreams WHERE workstream_id = ?',
                [workstreamId]
            );

            const [users] = await connection.execute(
                'SELECT * FROM users WHERE user_id = ?',
                [userId]
            );

            if (workstreams.length > 0 && users.length > 0) {
                const workstream = workstreams[0];
                const user = users[0];
                const data = {
                    title: workstream.title,
                    nextSteps: 'Check your dashboard for additional workstreams or assessments.'
                };

                const userName = `${user.first_name} ${user.last_name}`;
                await emailService.sendToSpecificUser(
                    'completion', 
                    data, 
                    workstreamId, 
                    'workstream', 
                    user.email, 
                    userName
                );
                console.log(`🎉 Sent completion notification to ${user.email} for: ${workstream.title}`);
            }
        } finally {
            await connection.end();
        }
    }

    async notifyUpdate(targetId, targetType, changes) {
        const connection = await this.getConnection();
        try {
            let query, title;
            
            switch (targetType) {
                case 'workstream':
                    const [workstreams] = await connection.execute(
                        'SELECT title FROM workstreams WHERE workstream_id = ?',
                        [targetId]
                    );
                    title = workstreams[0]?.title;
                    break;
                case 'chapter':
                    const [chapters] = await connection.execute(
                        'SELECT title FROM chapters WHERE chapter_id = ?',
                        [targetId]
                    );
                    title = chapters[0]?.title;
                    break;
                case 'assessment':
                    const [assessments] = await connection.execute(
                        'SELECT title FROM assessments WHERE assessment_id = ?',
                        [targetId]
                    );
                    title = assessments[0]?.title;
                    break;
            }

            if (title) {
                const data = {
                    id: targetId,
                    title: title,
                    type: targetType,
                    changes: changes
                };

                await emailService.sendNotification('update', data, targetId, targetType);
                console.log(`📝 Sent update notifications for: ${title}`);
            }
        } finally {
            await connection.end();
        }
    }
}

export default new NotificationService();
