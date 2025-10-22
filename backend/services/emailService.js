import nodemailer from 'nodemailer';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
    constructor() {
        const useCustomSmtp = !!process.env.EMAIL_HOST;
        const baseAuth = {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        };

        const transportOptions = useCustomSmtp
            ? {
                host: process.env.EMAIL_HOST,
                port: Number(process.env.EMAIL_PORT || 587),
                secure: String(process.env.EMAIL_SECURE || 'false').toLowerCase() === 'true',
                auth: baseAuth,
            }
            : {
                service: 'gmail',
                auth: baseAuth,
            };

        // Optional DKIM for better deliverability
        if (
            process.env.EMAIL_DKIM_DOMAIN &&
            process.env.EMAIL_DKIM_SELECTOR &&
            process.env.EMAIL_DKIM_PRIVATE_KEY
        ) {
            transportOptions.dkim = {
                domainName: process.env.EMAIL_DKIM_DOMAIN,
                keySelector: process.env.EMAIL_DKIM_SELECTOR,
                privateKey: process.env.EMAIL_DKIM_PRIVATE_KEY,
            };
        }

        this.transporter = nodemailer.createTransport(transportOptions);

        // Use EMAIL_USER as From address if FROM_ADDRESS not specified
        this.defaultFromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER;
        this.defaultFromName = process.env.EMAIL_FROM_NAME || 'Project Arkanghel';
        this.defaultReplyTo = process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER;

        this.dbConfig = {
            host: process.env.DB_HOST || "localhost",
            user: process.env.DB_USER || "root",
            password: process.env.DB_PASSWORD || "password",
            database: process.env.DB_NAME || "arkanghel_db"
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

    // Map notification types to database ENUM values
    mapTypeToDbEnum(type) {
        const typeMapping = {
            'new_workstream': 'workstream',
            'new_chapter': 'chapter',
            'new_assessment': 'assessment',
            'deadline_reminder_week': 'reminder',
            'deadline_reminder_day': 'reminder'
        };
        return typeMapping[type] || type;
    }

    async logNotification(type, targetId, targetType, recipientEmail, subject, status = 'pending', errorMessage = null) {
        const connection = await this.getConnection();
        try {
            const notificationId = uuidv4();
            const dbType = this.mapTypeToDbEnum(type);
            await connection.execute(
                `INSERT INTO notifications_log 
                (notification_id, type, target_id, target_type, recipient_email, subject, status, error_message, sent_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    notificationId,
                    dbType,
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
                    <p>We're excited to announce that a new training workstream is now available on the Project Arkanghel platform.</p>
                    <div class="accent-line"></div>
                    <div class="details success">
                        <h3 style="color: #1e40af; margin-top: 0;">${data.title}</h3>
                        <p><strong>Overview:</strong> ${data.description}</p>
                        ${data.deadline ? `<p><strong>Target Completion:</strong> <span class="highlight">${new Date(data.deadline).toLocaleDateString()}</span></p>` : ''}
                    </div>
                    <div style="text-align: center;">
                        <a href="${this.frontendUrl}/workstreams/${data.workstream_id}" class="button" style="color: #ffffff !important; text-decoration: none;">Begin Learning Journey</a>
                    </div>
                    <p style="margin-top: 25px;">This workstream has been carefully designed to enhance your professional skills and knowledge. We encourage you to begin at your earliest convenience to maximize your learning experience.</p>
                `;

            case 'new_chapter':
                return `
                    <p>Great news! A new chapter has been published and is ready for your review. This content builds upon your existing knowledge and will further advance your professional development.</p>
                    <div class="accent-line"></div>
                    <div class="details success">
                        <h3 style="color: #1e40af; margin-top: 0;">${data.chapter_title}</h3>
                        <p><strong>Part of Workstream:</strong> <span class="highlight">${data.workstream_title}</span></p>
                        <p><strong>Content Overview:</strong> ${data.content || 'New learning material available'}</p>
                        ${data.deadline ? `<p><strong>Recommended Completion:</strong> <span class="highlight">${new Date(data.deadline).toLocaleDateString()}</span></p>` : ''}
                    </div>
                    <div style="text-align: center;">
                        <a href="${this.frontendUrl}/workstreams/${data.workstream_id}/chapters/${data.chapter_id}" class="button" style="color: #ffffff !important; text-decoration: none;">Access Chapter</a>
                    </div>
                    <p style="margin-top: 25px;">This chapter contains valuable insights and practical knowledge. We recommend reviewing it as part of your continuous learning journey.</p>
                `;

            case 'new_assessment':
                return `
                    <p>An assessment opportunity is now available for you to demonstrate your knowledge and skills. This is an excellent chance to showcase your learning progress.</p>
                    <div class="accent-line"></div>
                    <div class="details success">
                        <h3 style="color: #1e40af; margin-top: 0;">${data.title}</h3>
                        <p><strong>Related to:</strong> <span class="highlight">${data.chapter_title || data.workstream_title || 'Training Module'}</span></p>
                        <p><strong>Total Points:</strong> ${data.total_points || 'TBD'} points</p>
                        <p><strong>Passing Score:</strong> ${data.passing_score || 70}%</p>
                        ${data.deadline ? `<p><strong>Due Date:</strong> <span class="highlight">${new Date(data.deadline).toLocaleDateString()}</span></p>` : ''}
                    </div>
                    <div style="text-align: center;">
                        <a href="${this.frontendUrl}/assessments/${data.assessment_id}" class="button" style="color: #ffffff !important; text-decoration: none;">Begin Assessment</a>
                    </div>
                    <p style="margin-top: 25px;">This assessment has been designed to evaluate your understanding and application of the concepts covered in your training. Take your time and demonstrate your expertise.</p>
                `;

            case 'deadline_reminder_week':
                return `
                    <div class="details warning">
                        <h3>Deadline Reminder - 1 Week</h3>
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
                        <h3>Urgent: Deadline Tomorrow!</h3>
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
                        <h3>Overdue: Immediate Action Required</h3>
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
                        <h3>Congratulations! Workstream Completed</h3>
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
            console.log(`📧 EmailService: Preparing to send ${type} notifications to ${users.length} users`);
            
            if (users.length === 0) {
                console.log('⚠️ No active users found for email notifications');
                return { success: true, message: 'No active users to notify', results: [] };
            }

            // Start sending emails asynchronously but return immediately with initial status
            const emailPromises = users.map(async (user) => {
                const recipientName = `${user.first_name} ${user.last_name}`;
                const subject = this.getSubjectByType(type, data);
                const htmlContent = this.generateEmailTemplate(type, data, recipientName);

                // Log notification as pending
                const notificationId = await this.logNotification(
                    type, targetId, targetType, user.email, subject, 'pending'
                );

                try {
                    await this.transporter.sendMail({
                        from: `"${this.defaultFromName}" <${this.defaultFromAddress}>`,
                        replyTo: this.defaultReplyTo,
                        envelope: { from: process.env.EMAIL_USER, to: user.email },
                        to: user.email,
                        subject: subject,
                        html: htmlContent
                    });

                    // Update status to sent
                    await this.updateNotificationStatus(notificationId, 'sent');
                    console.log(`✅ Email sent successfully to ${user.email}`);
                    return { email: user.email, status: 'sent', notificationId };

                } catch (error) {
                    console.error(`❌ Failed to send email to ${user.email}:`, error.message);
                    await this.updateNotificationStatus(notificationId, 'failed', error.message);
                    return { email: user.email, status: 'failed', error: error.message, notificationId };
                }
            });

            // Send first batch quickly to verify setup, then continue in background
            const firstBatch = emailPromises.slice(0, 2); // Test with first 2 users
            const remainingBatch = emailPromises.slice(2);

            try {
                // Wait for first batch with short timeout to verify email service works
                const firstResults = await Promise.race([
                    Promise.all(firstBatch),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Initial email batch timeout')), 3000)
                    )
                ]);

                console.log(`✅ First batch of ${firstResults.length} emails processed successfully`);
                
                // Continue sending remaining emails in background (don't await)
                if (remainingBatch.length > 0) {
                    console.log(`📤 Sending remaining ${remainingBatch.length} emails in background...`);
                    Promise.all(remainingBatch).then(remainingResults => {
                        const totalSent = [...firstResults, ...remainingResults].filter(r => r.status === 'sent').length;
                        console.log(`📧 Background email batch completed: ${totalSent}/${users.length} emails sent successfully`);
                    }).catch(err => {
                        console.error('❌ Error in background email batch:', err.message);
                    });
                }

                return {
                    success: true,
                    message: `Email notifications initiated for ${users.length} users`,
                    results: firstResults,
                    totalUsers: users.length,
                    backgroundProcessing: remainingBatch.length > 0
                };

            } catch (error) {
                // If first batch fails, try to send all emails in background anyway
                console.error('❌ First batch failed, sending all emails in background:', error.message);
                
                Promise.all(emailPromises).then(results => {
                    const totalSent = results.filter(r => r.status === 'sent').length;
                    console.log(`📧 Background email processing completed: ${totalSent}/${users.length} emails sent`);
                }).catch(err => {
                    console.error('❌ Background email processing failed:', err.message);
                });

                return {
                    success: true,
                    message: `Email notifications queued for ${users.length} users (processing in background)`,
                    results: [],
                    totalUsers: users.length,
                    backgroundProcessing: true,
                    warning: 'Initial batch timed out, emails processing in background'
                };
            }

        } catch (error) {
            console.error('❌ Error in sendNotification:', error);
            return {
                success: false,
                error: error.message,
                message: `Failed to send notifications: ${error.message}`
            };
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
                from: `"${this.defaultFromName}" <${this.defaultFromAddress}>`,
                replyTo: this.defaultReplyTo,
                envelope: { from: process.env.EMAIL_USER, to: userEmail },
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
