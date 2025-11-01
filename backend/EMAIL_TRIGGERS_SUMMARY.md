# Email Notification Triggers - Project Arkanghel
## Updated: October 26, 2025

---

## ✅ ACTIVE EMAIL TRIGGERS

### 1. **Deadline Reminders (Automated - Cron Job)**
**Trigger**: Runs automatically every day at midnight  
**Schedule**: `0 0 * * *` (daily at 00:00)  
**File**: `services/notificationService.js`

#### 1a. One Week Before Deadline
- **Type**: `deadline_reminder_week`
- **Subject**: "Deadline Reminder - 1 Week: {title}"
- **Recipients**: Users with incomplete workstreams/chapters/assessments due in 7 days
- **Content**: 
  - Item title
  - Deadline date
  - "You have 1 week remaining to complete this {type}"
  - Link to continue

#### 1b. One Day Before Deadline
- **Type**: `deadline_reminder_day`
- **Subject**: "Urgent: Deadline Tomorrow - {title}"
- **Recipients**: Users with incomplete workstreams/chapters/assessments due in 1 day
- **Content**:
  - Item title
  - Deadline date
  - "You have less than 24 hours to complete this {type}"
  - Urgent call to action
  - Link to complete

---

### 2. **Overdue Notifications (Automated - Cron Job)**
**Trigger**: Runs automatically every day at midnight  
**Schedule**: Same cron job as deadline reminders  
**File**: `services/notificationService.js`

- **Type**: `overdue`
- **Subject**: "Overdue: {title}"
- **Recipients**: Users with overdue incomplete workstreams/chapters/assessments
- **Content**:
  - Item title
  - Original deadline date
  - Days overdue
  - "Immediate action required"
  - Link to complete immediately

---

### 3. **Workstream Completion**
**Trigger**: When user completes all chapters and assessments in a workstream  
**File**: `services/notificationService.js` (line ~537)  
**Method**: `emailService.sendToSpecificUser()`

- **Type**: `completion`
- **Subject**: "Congratulations! Workstream Completed: {title}"
- **Recipients**: Individual user who completed the workstream
- **Content**:
  - Workstream title
  - Completion date
  - Congratulations message
  - Next steps (if provided)
  - Link to dashboard

---

---

## ❌ DISABLED EMAIL TRIGGERS

The following triggers have been **DISABLED** and will no longer send emails:

### ~~1. New Workstream Published~~ ❌
- **Previously triggered**: When admin published a workstream
- **Disabled in**: `routes/admin/A_Modules.js` (line ~895)
- **Reason**: Users will be notified via deadline reminders instead

### ~~2. New Chapter Published~~ ❌
- **Previously triggered**: When admin published a chapter
- **Disabled in**: `routes/admin/ChapterEdit.js` (line ~288)
- **Reason**: Users will be notified via deadline reminders instead

### ~~3. New Assessment Published~~ ❌
- **Previously triggered**: When admin created/published an assessment
- **Disabled in**: `routes/admin/A_Modules.js` (lines ~1125, ~1171)
- **Reason**: Users will be notified via deadline reminders instead

### ~~4. Content Update Notifications~~ ❌
- **Previously triggered**: When admin updated workstream/chapter/assessment content
- **Disabled in**: `services/notificationService.js` (line ~582)
- **Reason**: Users will only receive deadline reminders instead

---

## 📊 Summary of Active Triggers

| Trigger | Type | Frequency | Recipients | Automated |
|---------|------|-----------|------------|-----------|
| **1 Week Deadline Reminder** | deadline_reminder_week | Daily (midnight) | Users with items due in 7 days | ✅ Yes |
| **1 Day Deadline Reminder** | deadline_reminder_day | Daily (midnight) | Users with items due in 1 day | ✅ Yes |
| **Overdue Notification** | overdue | Daily (midnight) | Users with overdue items | ✅ Yes |
| **Workstream Completion** | completion | On completion | Individual user | ❌ No (event-based) |

---

## 🧪 How to Test Active Triggers

### Test Deadline Reminders
**Option A**: Wait for midnight (cron runs automatically)

**Option B**: Manually trigger via API
```bash
curl -X POST http://localhost:8081/api/notifications/test-deadline-reminders
```

**Option C**: Temporarily modify cron schedule
1. Edit `services/notificationService.js` line 37
2. Change `'0 0 * * *'` to `'*/5 * * * *'` (every 5 minutes)
3. Restart backend
4. Wait 5 minutes
5. Change back to original schedule

### Test Completion Email
1. Log in as employee
2. Complete all chapters in a workstream
3. Complete all assessments in that workstream
4. System automatically detects completion
5. Check inbox for completion email

---

## 📋 Monitoring Email Delivery

### Check Database Logs
```sql
SELECT 
    notification_id,
    type,
    recipient_email,
    subject,
    status,
    sent_at,
    error_message
FROM notifications_log
WHERE type IN ('deadline_reminder_week', 'deadline_reminder_day', 'overdue', 'completion')
ORDER BY created_at DESC
LIMIT 20;
```

### Check via API
```bash
# Get recent logs
curl http://localhost:8081/api/notifications/logs?limit=20

# Get statistics
curl http://localhost:8081/api/notifications/stats
```

### Backend Console Logs
Watch for:
- `📧 EmailService: Preparing to send {type} notifications to {count} users`
- `✅ Email sent successfully to {email}`
- `❌ Failed to send email to {email}: {error}`

---

## 🔧 Configuration

### Cron Schedule
**Location**: `services/notificationService.js` (line 37)  
**Current**: `'0 0 * * *'` (daily at midnight)  
**Format**: `minute hour day month weekday`

### Email Settings
**Location**: `backend/.env`
```env
EMAIL_USER=baron.niog_intern@aboitizpower.com
EMAIL_PASS=your_app_password
```

---

## 📝 Notes

- **No spam on publish**: Users are no longer notified when content is published
- **Deadline-focused**: All notifications are now deadline-driven
- **Automated reminders**: System automatically sends reminders at 1 week and 1 day before deadline
- **Completion recognition**: Users receive congratulations when completing workstreams
- **Update awareness**: Users are notified when content they need to complete is updated

---

## 🎯 Benefits of Current Setup

1. **Reduced email volume**: Users only receive relevant, time-sensitive emails
2. **Better engagement**: Deadline reminders encourage timely completion
3. **Less noise**: No immediate notifications when content is published
4. **Focused communication**: Emails are sent when action is needed
5. **Completion celebration**: Users feel recognized when completing workstreams

---

**Last Updated**: October 26, 2025  
**Email System**: ✅ Active  
**Sender**: baron.niog_intern@aboitizpower.com  
**Active Triggers**: 4 (Deadline reminders, Overdue, Completion)  
**Disabled Triggers**: 4 (New workstream, New chapter, New assessment, Content updates)
