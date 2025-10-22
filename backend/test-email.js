import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function testEmailConfig() {
    console.log('='.repeat(60));
    console.log('📧 EMAIL CONFIGURATION TEST');
    console.log('='.repeat(60));
    
    // Display configuration (hide password)
    console.log('\n📋 Current Configuration:');
    console.log(`   AUTH USER:       ${process.env.EMAIL_USER}`);
    console.log(`   AUTH PASS:       ${process.env.EMAIL_PASS ? '✓ Set (hidden)' : '✗ Not set'}`);
    console.log(`   FROM NAME:       ${process.env.EMAIL_FROM_NAME || 'Project Arkanghel Notifications'}`);
    console.log(`   FROM ADDRESS:    ${process.env.EMAIL_FROM_ADDRESS || 'no-reply@aboitizpower.com'}`);
    console.log(`   REPLY-TO:        ${process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER}`);
    
    // Create transporter
    console.log('\n🔧 Creating email transporter...');
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    // Verify connection
    console.log('🔍 Verifying SMTP connection...');
    try {
        await transporter.verify();
        console.log('✅ SMTP connection verified successfully!');
    } catch (error) {
        console.error('❌ SMTP verification failed:', error.message);
        process.exit(1);
    }

    // Send test email
    console.log('\n📤 Sending test email...');
    const defaultFromName = process.env.EMAIL_FROM_NAME || 'Project Arkanghel';
    const defaultFromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER;
    const defaultReplyTo = process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER;

    const testEmail = {
        from: `"${defaultFromName}" <${defaultFromAddress}>`,
        replyTo: defaultReplyTo,
        envelope: {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER // Send test to yourself
        },
        to: process.env.EMAIL_USER, // Send test to yourself
        subject: 'Project Arkanghel Email Configuration Test',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
                    .success { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 15px; margin: 20px 0; color: #155724; }
                    .info-box { background: white; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; border-radius: 4px; }
                    .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 2px solid #3b82f6; }
                    code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Email Configuration Test</h1>
                    <p>Project Arkanghel</p>
                </div>
                <div class="content">
                    <div class="success">
                        <strong>SUCCESS!</strong> Your email configuration is working correctly.
                    </div>
                    
                    <h2>Configuration Details:</h2>
                    <div class="info-box">
                        <strong>Authenticated Sender:</strong><br>
                        <code>${process.env.EMAIL_USER}</code>
                    </div>
                    <div class="info-box">
                        <strong>Visible From Address:</strong><br>
                        <code>${defaultFromName} &lt;${defaultFromAddress}&gt;</code>
                    </div>
                    <div class="info-box">
                        <strong>Reply-To Address:</strong><br>
                        <code>${defaultReplyTo}</code>
                    </div>
                    
                    <h2>What This Means:</h2>
                    <ul>
                        <li>Authentication with <strong>${process.env.EMAIL_USER}</strong> is working</li>
                        <li>Recipients will see emails from <strong>${defaultFromAddress}</strong></li>
                        <li>Replies will go to <strong>${defaultReplyTo}</strong></li>
                        <li>SMTP connection is stable and ready for production</li>
                    </ul>

                    <h2>Next Steps:</h2>
                    <ol>
                        <li>Check the email headers to verify SPF/DKIM/DMARC pass</li>
                        <li>Test sending notifications from your application</li>
                        <li>Monitor the notifications_log table for delivery status</li>
                    </ol>

                    <p><strong>Note:</strong> If this email landed in spam, check your domain's SPF/DKIM/DMARC records.</p>
                </div>
                <div class="footer">
                    <p>Project Arkanghel Training System</p>
                    <p>Test sent at: ${new Date().toLocaleString()}</p>
                </div>
            </body>
            </html>
        `
    };

    try {
        const info = await transporter.sendMail(testEmail);
        console.log('✅ Test email sent successfully!');
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`   Recipient:  ${process.env.EMAIL_USER}`);
        console.log(`   From:       "${defaultFromName}" <${defaultFromAddress}>`);
        console.log(`   Reply-To:   ${defaultReplyTo}`);
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 EMAIL CONFIGURATION TEST PASSED!');
        console.log('='.repeat(60));
        console.log('\n📬 Check your inbox at:', process.env.EMAIL_USER);
        console.log('💡 Verify the following in the received email:');
        console.log(`   1. From shows: "${defaultFromName}" <${defaultFromAddress}>`);
        console.log(`   2. Reply-To shows: ${defaultReplyTo}`);
        console.log('   3. Email is not in spam folder');
        console.log('   4. Check email headers for SPF/DKIM/DMARC pass');
        console.log('\n');
        
    } catch (error) {
        console.error('❌ Failed to send test email:', error.message);
        console.error('\n🔧 Troubleshooting:');
        console.error('   1. Verify EMAIL_USER and EMAIL_PASS are correct');
        console.error('   2. Ensure 2FA is enabled and you\'re using an App Password');
        console.error('   3. Check if "Less secure app access" needs to be enabled');
        console.error('   4. Verify your Google Workspace admin allows SMTP access');
        process.exit(1);
    }
}

testEmailConfig().catch(error => {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
});
