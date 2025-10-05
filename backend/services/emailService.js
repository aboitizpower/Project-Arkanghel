import nodemailer from 'nodemailer';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        this.dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        };

        this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    }

    async getConnection() {
        return await mysql.createConnection(this.dbConfig);
    }

    async getAllActiveUsers() {
        const connection = await this.getConnection();
        try {
            // Get all users (since there's no status column, we'll get all users)
            const [users] = await connection.execute(
                'SELECT user_id, email, first_name, last_name FROM users WHERE email IS NOT NULL AND email != ""'
            );
            return users;
        } finally {
            await connection.end();
        }
    }

    async logNotification(type, targetId, targetType, recipientEmail, subject, status = 'pending', errorMessage = null) {
        const connection = await this.getConnection();
        try {
            const notificationId = uuidv4();
            await connection.execute(
                `INSERT INTO notifications_log 
                (notification_id, type, target_id, target_type, recipient_email, subject, status, error_message, sent_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    notificationId,
                    type,
                    targetId,
                    targetType,
                    recipientEmail,
                    subject,
                    status,
                    errorMessage,
                    status === 'sent' ? new Date() : null
                ]
            );
            return notificationId;
        } finally {
            await connection.end();
        }
    }

    async updateNotificationStatus(notificationId, status, errorMessage = null) {
        const connection = await this.getConnection();
        try {
            await connection.execute(
                `UPDATE notifications_log 
                SET status = ?, error_message = ?, sent_at = ? 
                WHERE notification_id = ?`,
                [status, errorMessage, status === 'sent' ? new Date() : null, notificationId]
            );
        } finally {
            await connection.end();
        }
    }

    generateEmailTemplate(type, data, recipientName) {
        const baseTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Project Arkanghel Notification</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #2c3e50; margin: 0; padding: 0; background-color: #f8fafc; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%); color: white; padding: 35px; text-align: center; border-radius: 12px 12px 0 0; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2); position: relative; }
                .header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%); }
                .content { background: white; padding: 35px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); }
                .button { display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; margin: 25px 0; font-weight: 600; font-size: 16px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3); border: 2px solid transparent; }
                .button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4); border-color: #fbbf24; }
                .details { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 5px solid #3b82f6; border-top: 2px solid #fbbf24; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1); }
                .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 30px; padding: 25px 0; border-top: 3px solid #fbbf24; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border-radius: 0 0 12px 12px; }
                .urgent { border-left-color: #dc2626 !important; border-top-color: #fbbf24 !important; }
                .success { border-left-color: #059669 !important; border-top-color: #fbbf24 !important; }
                .warning { border-left-color: #d97706 !important; border-top-color: #fbbf24 !important; }
                .highlight { color: #1e40af; font-weight: 700; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); padding: 2px 8px; border-radius: 4px; border-left: 3px solid #fbbf24; }
                .accent-line { height: 2px; background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%); margin: 20px 0; border-radius: 1px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Project Arkanghel</h1>
                    <p>Training & Development Platform</p>
                </div>
                <div class="content">
                    <h2>Hello ${recipientName},</h2>
                    ${this.getContentByType(type, data)}
                </div>
                <div class="footer">
                    <p><strong>Project Arkanghel Training System</strong></p>
                    <p>This is an automated notification to keep you updated on your training progress.</p>
                    <p style="margin-top: 15px; font-size: 12px;">© 2024 Project Arkanghel. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>`;
        
        return baseTemplate;
    }

    getContentByType(type, data) {
        switch (type) {
            case 'new_workstream':
                return `
                    <p>A new training workstream has been published and is now available for you to complete.</p>
                    <div class="accent-line"></div>
                    <div class="details">
                        <h3 style="color: #1e40af; margin-top: 0;">${data.title}</h3>
                        <p><strong>Description:</strong> ${data.description}</p>
                        <p><strong>Deadline:</strong> <span class="highlight">${new Date(data.deadline).toLocaleDateString()}</span></p>
                    </div>
                    <div style="text-align: center;">
                        <a href="${this.frontendUrl}/workstreams/${data.workstream_id}" class="button" style="color: #ffffff !important; text-decoration: none;">Start Training</a>
                    </div>
                    <p style="margin-top: 25px;">Please complete this workstream before the deadline to stay on track with your professional development.</p>
                `;

            case 'new_chapter':
                return `
                    <p>A new chapter has been added to one of your training workstreams.</p>
                    <div class="accent-line"></div>
                    <div class="details">
                        <h3 style="color: #1e40af; margin-top: 0;">${data.chapter_title}</h3>
                        <p><strong>Workstream:</strong> <span class="highlight">${data.workstream_title}</span></p>
                        <p><strong>Description:</strong> ${data.description}</p>
                        <p><strong>Deadline:</strong> <span class="highlight">${new Date(data.deadline).toLocaleDateString()}</span></p>
                    </div>
                    <div style="text-align: center;">
                        <a href="${this.frontendUrl}/workstreams/${data.workstream_id}/chapters/${data.chapter_id}" class="button" style="color: #ffffff !important; text-decoration: none;">Read Chapter</a>
                    </div>
                    <p style="margin-top: 25px;">Start working on this chapter to continue your training progress and stay on track.</p>
                `;

            case 'new_assessment':
                return `
                    <p>A new assessment has been published and is ready for you to complete.</p>
                    <div class="details">
                        <h3>${data.title}</h3>
                        <p><strong>Connected to:</strong> ${data.connected_title}</p>
                        <p><strong>Deadline:</strong> ${new Date(data.deadline).toLocaleDateString()}</p>
                    </div>
                    <a href="${this.frontendUrl}/assessments/${data.assessment_id}" class="button">Take Assessment</a>
                    <p>Complete this assessment to demonstrate your understanding of the material.</p>
                `;

            case 'deadline_reminder_week':
                return `
                    <div class="details warning">
                        <h3>⚠️ Deadline Reminder - 1 Week</h3>
                        <p><strong>${data.title}</strong></p>
                        <p><strong>Deadline:</strong> ${new Date(data.deadline).toLocaleDateString()}</p>
                        <p>You have <strong>1 week</strong> remaining to complete this ${data.type}.</p>
                    </div>
                    <a href="${this.frontendUrl}/${data.type}s/${data.id}" class="button">Continue ${data.type}</a>
                    <p>Don't wait until the last minute - start working on this now to ensure timely completion.</p>
                `;

            case 'deadline_reminder_day':
                return `
                    <div class="details urgent">
                        <h3>🚨 Urgent: Deadline Tomorrow!</h3>
                        <p><strong>${data.title}</strong></p>
                        <p><strong>Deadline:</strong> ${new Date(data.deadline).toLocaleDateString()}</p>
                        <p>You have <strong>less than 24 hours</strong> to complete this ${data.type}!</p>
                    </div>
                    <a href="${this.frontendUrl}/${data.type}s/${data.id}" class="button">Complete Now</a>
                    <p><strong>Action Required:</strong> Please complete this immediately to avoid missing the deadline.</p>
                `;

            case 'overdue':
                return `
                    <div class="details urgent">
                        <h3>🚨 Overdue: Immediate Action Required</h3>
                        <p><strong>${data.title}</strong></p>
                        <p><strong>Original Deadline:</strong> ${new Date(data.deadline).toLocaleDateString()}</p>
                        <p><strong>Days Overdue:</strong> ${data.daysOverdue}</p>
                    </div>
                    <a href="${this.frontendUrl}/${data.type}s/${data.id}" class="button">Complete Immediately</a>
                    <p><strong>This ${data.type} is overdue and requires immediate completion.</strong> Please prioritize this task and complete it as soon as possible.</p>
                `;

            case 'completion':
                return `
                    <div class="details success">
                        <h3>🎉 Congratulations! Workstream Completed</h3>
                        <p><strong>${data.title}</strong></p>
                        <p><strong>Completed on:</strong> ${new Date().toLocaleDateString()}</p>
                    </div>
                    <p>Excellent work! You have successfully completed this workstream.</p>
                    ${data.nextSteps ? `<p><strong>Next Steps:</strong> ${data.nextSteps}</p>` : ''}
                    <a href="${this.frontendUrl}/dashboard" class="button">View Dashboard</a>
                `;

            case 'update':
                return `
                    <p>An item in your training has been updated. Please review the changes below.</p>
                    <div class="details">
                        <h3>${data.title}</h3>
                        <p><strong>Type:</strong> ${data.type}</p>
                        <p><strong>Changes Made:</strong></p>
                        <ul>
                            ${data.changes.map(change => `<li><strong>${change.field}:</strong> ${change.oldValue} → ${change.newValue}</li>`).join('')}
                        </ul>
                    </div>
                    <a href="${this.frontendUrl}/${data.type}s/${data.id}" class="button">View Updated ${data.type}</a>
                    <p>Please review these changes and adjust your schedule accordingly.</p>
                `;

            default:
                return `<p>You have a new notification from Project Arkanghel.</p>`;
        }
    }

    getSubjectByType(type, data) {
        switch (type) {
            case 'new_workstream':
                return `New Workstream Published: ${data.title}`;
            case 'new_chapter':
                return `New Chapter in ${data.workstream_title}: ${data.chapter_title}`;
            case 'new_assessment':
                return `New Assessment Published: ${data.title}`;
            case 'deadline_reminder_week':
                return `Reminder: ${data.type} Deadline Approaching – ${data.title}`;
            case 'deadline_reminder_day':
                return `Urgent: ${data.type} Due Tomorrow – ${data.title}`;
            case 'overdue':
                return `Overdue: ${data.title}`;
            case 'completion':
                return `Workstream Completed: ${data.title}`;
            case 'update':
                return `Updated: ${data.title}`;
            default:
                return 'Project Arkanghel Notification';
        }
    }

    async sendNotification(type, data, targetId, targetType) {
        try {
            const users = await this.getAllActiveUsers();
            const results = [];

            for (const user of users) {
                const recipientName = `${user.first_name} ${user.last_name}`;
                const subject = this.getSubjectByType(type, data);
                const htmlContent = this.generateEmailTemplate(type, data, recipientName);

                // Log notification as pending
                const notificationId = await this.logNotification(
                    type, targetId, targetType, user.email, subject, 'pending'
                );

                try {
                    await this.transporter.sendMail({
                        from: `"Project Arkanghel: End-User Training System" <${process.env.EMAIL_USER}>`,
                        to: user.email,
                        subject: subject,
                        html: htmlContent
                    });

                    // Update status to sent
                    await this.updateNotificationStatus(notificationId, 'sent');
                    results.push({ email: user.email, status: 'sent', notificationId });

                } catch (error) {
                    console.error(`Failed to send email to ${user.email}:`, error);
                    await this.updateNotificationStatus(notificationId, 'failed', error.message);
                    results.push({ email: user.email, status: 'failed', error: error.message, notificationId });
                }
            }

            return results;
        } catch (error) {
            console.error('Error in sendNotification:', error);
            throw error;
        }
    }

    async sendToSpecificUser(type, data, targetId, targetType, userEmail, userName) {
        const subject = this.getSubjectByType(type, data);
        const htmlContent = this.generateEmailTemplate(type, data, userName);

        // Log notification as pending
        const notificationId = await this.logNotification(
            type, targetId, targetType, userEmail, subject, 'pending'
        );

        try {
            await this.transporter.sendMail({
                from: `"Project Arkanghel: End-User Training System" <${process.env.EMAIL_USER}>`,
                to: userEmail,
                subject: subject,
                html: htmlContent
            });

            // Update status to sent
            await this.updateNotificationStatus(notificationId, 'sent');
            return { email: userEmail, status: 'sent', notificationId };

        } catch (error) {
            console.error(`Failed to send email to ${userEmail}:`, error);
            await this.updateNotificationStatus(notificationId, 'failed', error.message);
            throw error;
        }
    }
}

export default new EmailService();
