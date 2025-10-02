import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Generate a certificate of completion for a workstream
 * @param {Object} certificateData - Data needed for certificate generation
 * @param {string} certificateData.userName - Full name of the user
 * @param {string} certificateData.workstreamTitle - Title of the completed workstream
 * @param {Date} certificateData.completionDate - Date when workstream was completed
 * @param {string} certificateData.userEmail - Email of the user
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generateCertificate = (certificateData) => {
    return new Promise((resolve, reject) => {
        try {
            const { userName, workstreamTitle, completionDate, userEmail } = certificateData;
            
            // Create a new PDF document
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'landscape',
                margins: {
                    top: 50,
                    bottom: 50,
                    left: 50,
                    right: 50
                }
            });

            // Buffer to store PDF data
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // Certificate styling
            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;
            const centerX = pageWidth / 2;

            // Background and border
            doc.rect(30, 30, pageWidth - 60, pageHeight - 60)
               .stroke('#2c3e50')
               .lineWidth(3);

            doc.rect(40, 40, pageWidth - 80, pageHeight - 80)
               .stroke('#3498db')
               .lineWidth(1);

            // Header - Certificate of Completion
            doc.fontSize(36)
               .font('Helvetica-Bold')
               .fillColor('#2c3e50')
               .text('CERTIFICATE OF COMPLETION', 0, 100, {
                   align: 'center',
                   width: pageWidth
               });

            // Decorative line
            doc.moveTo(centerX - 150, 150)
               .lineTo(centerX + 150, 150)
               .stroke('#3498db')
               .lineWidth(2);

            // "This is to certify that" text
            doc.fontSize(16)
               .font('Helvetica')
               .fillColor('#34495e')
               .text('This is to certify that', 0, 200, {
                   align: 'center',
                   width: pageWidth
               });

            // User name (prominent)
            doc.fontSize(32)
               .font('Helvetica-Bold')
               .fillColor('#2c3e50')
               .text(userName, 0, 240, {
                   align: 'center',
                   width: pageWidth
               });

            // "has successfully completed" text
            doc.fontSize(16)
               .font('Helvetica')
               .fillColor('#34495e')
               .text('has successfully completed the learning workstream', 0, 290, {
                   align: 'center',
                   width: pageWidth
               });

            // Workstream title (prominent)
            doc.fontSize(24)
               .font('Helvetica-Bold')
               .fillColor('#3498db')
               .text(workstreamTitle, 0, 330, {
                   align: 'center',
                   width: pageWidth
               });

            // Completion date
            const formattedDate = new Date(completionDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            doc.fontSize(14)
               .font('Helvetica')
               .fillColor('#34495e')
               .text(`Completed on ${formattedDate}`, 0, 390, {
                   align: 'center',
                   width: pageWidth
               });

            // Footer section
            const footerY = pageHeight - 120;
            
            // Arkanghel logo/text
            doc.fontSize(18)
               .font('Helvetica-Bold')
               .fillColor('#2c3e50')
               .text('ARKANGHEL', 80, footerY, {
                   align: 'left'
               });

            doc.fontSize(12)
               .font('Helvetica')
               .fillColor('#7f8c8d')
               .text('Learning Management System', 80, footerY + 25, {
                   align: 'left'
               });

            // Certificate ID (using user email and completion date for uniqueness)
            const certificateId = Buffer.from(`${userEmail}-${workstreamTitle}-${completionDate.getTime()}`).toString('base64').substring(0, 12).toUpperCase();
            
            doc.fontSize(10)
               .font('Helvetica')
               .fillColor('#95a5a6')
               .text(`Certificate ID: ${certificateId}`, pageWidth - 200, footerY + 35, {
                   align: 'right'
               });

            // Decorative elements
            // Top corners
            doc.circle(80, 80, 3).fill('#3498db');
            doc.circle(pageWidth - 80, 80, 3).fill('#3498db');
            
            // Bottom corners
            doc.circle(80, pageHeight - 80, 3).fill('#3498db');
            doc.circle(pageWidth - 80, pageHeight - 80, 3).fill('#3498db');

            // Finalize the PDF
            doc.end();

        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Check if a user has completed a workstream (100% progress)
 * @param {Object} db - Database connection
 * @param {number} userId - User ID
 * @param {number} workstreamId - Workstream ID
 * @returns {Promise<Object>} - Completion status and details
 */
export const checkWorkstreamCompletion = async (db, userId, workstreamId) => {
    try {
        const sql = `
            SELECT 
                w.title as workstream_title,
                w.workstream_id,
                u.first_name,
                u.last_name,
                u.email,
                COALESCE((
                    SELECT 
                        CASE 
                            WHEN total_items = 0 THEN 0
                            ELSE (completed_items * 100.0) / total_items
                        END
                    FROM (
                        SELECT 
                            -- Count completed chapters
                            COALESCE((
                                SELECT COUNT(DISTINCT up.chapter_id)
                                FROM user_progress up
                                JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
                                WHERE up.user_id = ? 
                                  AND mc.workstream_id = w.workstream_id 
                                  AND up.is_completed = TRUE
                                  AND mc.is_published = TRUE
                            ), 0) +
                            -- Count passed assessments (75% passing threshold)
                            COALESCE((
                                SELECT COUNT(DISTINCT a.assessment_id)
                                FROM assessments a
                                JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                                WHERE mc.workstream_id = w.workstream_id 
                                  AND mc.is_published = TRUE
                                  AND EXISTS (
                                      SELECT 1
                                      FROM answers ans
                                      JOIN questions q ON ans.question_id = q.question_id
                                      WHERE q.assessment_id = a.assessment_id 
                                        AND ans.user_id = ?
                                      GROUP BY q.assessment_id
                                      HAVING (SUM(ans.score) * 100.0 / COUNT(q.question_id)) >= 75
                                  )
                            ), 0) as completed_items,
                            -- Total chapters + assessments
                            COALESCE((
                                SELECT COUNT(*) 
                                FROM module_chapters mc 
                                WHERE mc.workstream_id = w.workstream_id 
                                  AND mc.is_published = TRUE
                            ), 0) +
                            COALESCE((
                                SELECT COUNT(DISTINCT a.assessment_id) 
                                FROM assessments a 
                                JOIN module_chapters mc ON a.chapter_id = mc.chapter_id 
                                WHERE mc.workstream_id = w.workstream_id 
                                  AND mc.is_published = TRUE
                            ), 0) as total_items
                    ) as progress_calc
                ), 0) as progress,
                -- Get the most recent completion date
                (
                    SELECT MAX(completion_time)
                    FROM user_progress up
                    JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
                    WHERE up.user_id = ? 
                      AND mc.workstream_id = w.workstream_id 
                      AND up.is_completed = TRUE
                ) as completion_date
            FROM workstreams w
            JOIN users u ON u.user_id = ?
            WHERE w.workstream_id = ?
        `;

        const [results] = await db.promise().query(sql, [userId, userId, userId, userId, workstreamId]);
        
        if (results.length === 0) {
            return { isCompleted: false, error: 'Workstream not found' };
        }

        const result = results[0];
        const isCompleted = result.progress >= 100;

        return {
            isCompleted,
            progress: result.progress,
            workstreamTitle: result.workstream_title,
            userName: `${result.first_name} ${result.last_name}`,
            userEmail: result.email,
            completionDate: result.completion_date || new Date() // Fallback to current date if no completion date
        };

    } catch (error) {
        console.error('Error checking workstream completion:', error);
        return { isCompleted: false, error: error.message };
    }
};
