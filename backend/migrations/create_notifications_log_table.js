import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'arkanghel_db',
    multipleStatements: true
};

async function createNotificationTables() {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        // Create notifications_log table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS notifications_log (
                notification_id VARCHAR(36) PRIMARY KEY,
                type ENUM('new_workstream', 'new_chapter', 'new_assessment', 'update', 'reminder', 'completion', 'overdue', 'reassignment', 'cancellation', 'deadline_reminder_week', 'deadline_reminder_day') NOT NULL,
                target_id VARCHAR(36) NOT NULL,
                target_type ENUM('workstream', 'chapter', 'assessment') NOT NULL,
                recipient_email VARCHAR(255) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
                error_message TEXT,
                sent_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_recipient (recipient_email),
                INDEX idx_target (target_id, target_type),
                INDEX idx_status (status, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Create notification_templates table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS notification_templates (
                template_id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                subject_template TEXT NOT NULL,
                html_template LONGTEXT NOT NULL,
                text_template TEXT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_template_name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Create notification_schedules table for scheduled reminders
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS notification_schedules (
                schedule_id VARCHAR(36) PRIMARY KEY,
                notification_type ENUM('reminder', 'overdue') NOT NULL,
                target_id VARCHAR(36) NOT NULL,
                target_type ENUM('assessment') NOT NULL,
                trigger_time DATETIME NOT NULL,
                status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
                last_run TIMESTAMP NULL DEFAULT NULL,
                next_run TIMESTAMP NULL DEFAULT NULL,
                retry_count INT DEFAULT 0,
                max_retries INT DEFAULT 3,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_trigger_time (trigger_time, status),
                INDEX idx_target (target_id, target_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('Created notification tables successfully');
    } catch (error) {
        console.error('Error creating notification tables:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

// Run the migration
createNotificationTables().catch(console.error);
