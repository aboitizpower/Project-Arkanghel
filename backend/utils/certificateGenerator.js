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
               .lineWidth(4);

            doc.rect(45, 45, pageWidth - 90, pageHeight - 90)
               .stroke('#3498db')
               .lineWidth(2);

            // Add background pattern image
            try {
                const backgroundPath = path.join(process.cwd(), 'assets', 'certbg.png');
                if (fs.existsSync(backgroundPath)) {
                    doc.save();
                    doc.opacity(0.3);
                    // Position the background pattern spanning from top to bottom, wider for better visual impact
                    const bgWidth = 900; // Increased width for wider appearance
                    const bgHeight = pageHeight - 100; // Full height minus margins
                    const bgX = pageWidth - bgWidth - 60; // Adjusted position to accommodate wider background
                    const bgY = 50; // Start from top margin
                    doc.image(backgroundPath, bgX, bgY, { width: bgWidth, height: bgHeight });
                    doc.restore();
                }
            } catch (error) {
                console.log('Background image not found, using fallback pattern');
                // Fallback pattern if image not found
                doc.save();
                doc.opacity(0.1);
                for (let i = 0; i < 20; i++) {
                    for (let j = 0; j < 15; j++) {
                        const x = 400 + (i * 20);
                        const y = 50 + (j * 20);
                        if (x < pageWidth - 100) {
                            doc.rect(x, y, 10, 10).fill('#3498db');
                            doc.rect(x + 10, y + 10, 10, 10).fill('#ffb347');
                        }
                    }
                }
                doc.restore();
            }

            // Add Arkanghel logo in top-left
            try {
                const logoPath = path.join(process.cwd(), 'assets', 'arkanghel_logo.png');
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 60, 60, { width: 45, height: 45 });
                } else {
                    // Fallback logo placeholder
                    doc.rect(60, 60, 45, 45)
                       .fill('#ff9500');
                    
                    doc.fontSize(8)
                       .font('Helvetica-Bold')
                       .fillColor('white')
                       .text('LOGO', 60, 78, {
                           width: 45,
                           align: 'center'
                       });
                }
            } catch (error) {
                console.log('Logo image not found, using fallback');
                // Fallback logo placeholder
                doc.rect(60, 60, 45, 45)
                   .fill('#ff9500');
                
                doc.fontSize(8)
                   .font('Helvetica-Bold')
                   .fillColor('white')
                   .text('LOGO', 60, 78, {
                       width: 45,
                       align: 'center'
                   });
            }

            // Header - Certificate of Completion
            doc.fontSize(36)
               .font('Helvetica-Bold')
               .fillColor('#2c3e50')
               .text('CERTIFICATE OF COMPLETION', 0, 130, {
                   align: 'center',
                   width: pageWidth
               });

            // Decorative line with orange gradient effect
            doc.moveTo(centerX - 100, 180)
               .lineTo(centerX - 20, 180)
               .stroke('#ff9500')
               .lineWidth(3);
            
            doc.moveTo(centerX - 20, 180)
               .lineTo(centerX + 20, 180)
               .stroke('#2c3e50')
               .lineWidth(3);
               
            doc.moveTo(centerX + 20, 180)
               .lineTo(centerX + 100, 180)
               .stroke('#ff9500')
               .lineWidth(3);

            // "This is to certify that" text
            doc.fontSize(16)
               .font('Helvetica')
               .fillColor('#34495e')
               .text('This is to certify that', 0, 220, {
                   align: 'center',
                   width: pageWidth
               });

            // User name (prominent)
            doc.fontSize(32)
               .font('Helvetica-Bold')
               .fillColor('#2c3e50')
               .text(userName.toUpperCase(), 0, 250, {
                   align: 'center',
                   width: pageWidth
               });

            // "has successfully completed" text
            doc.fontSize(16)
               .font('Helvetica')
               .fillColor('#34495e')
               .text('has successfully completed the learning workstream', 0, 300, {
                   align: 'center',
                   width: pageWidth
               });

            // Workstream title (prominent) - using orange color
            doc.fontSize(24)
               .font('Helvetica-Bold')
               .fillColor('#ff9500')
               .text(workstreamTitle, 0, 340, {
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
               .fillColor('#7f8c8d')
               .text(`Completed on ${formattedDate}`, 0, 390, {
                   align: 'center',
                   width: pageWidth
               });

            // Footer section
            const footerY = pageHeight - 120;
            
            // Project Arkanghel logo/text
            doc.fontSize(18)
               .font('Helvetica-Bold')
               .fillColor('#2c3e50')
               .text('PROJECT ARKANGHEL', 80, footerY, {
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

            // Decorative elements removed as requested

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
