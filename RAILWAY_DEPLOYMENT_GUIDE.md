# 🚂 Railway Deployment Guide - Project Arkanghel

Complete step-by-step guide to deploy your Learning Management System to Railway.

---

## 📋 Prerequisites

Before starting, make sure you have:
- ✅ GitHub account
- ✅ Credit/Debit card for Railway verification (won't be charged for $5 free tier)
- ✅ Your project pushed to GitHub
- ✅ All code committed and working locally

---

## 🎯 Deployment Overview

We'll deploy **3 services** on Railway:
1. **MySQL Database** - Your database
2. **Backend API** - Node.js/Express server
3. **Frontend** - React (Vite) static site

**Estimated Time:** 30-45 minutes  
**Monthly Cost:** ~$3-4 (covered by $5 free credit)

---

## 📝 Step 1: Prepare Your Project

### 1.1 Push to GitHub

If you haven't already:

```bash
# Initialize git (if not done)
git init

# Add all files
git add .

# Commit
git commit -m "Prepare for Railway deployment"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/project-arkanghel.git
git branch -M main
git push -u origin main
```

### 1.2 Verify Configuration Files

Make sure these files exist in your project:
- ✅ `backend/package.json` - Backend dependencies
- ✅ `frontend/package.json` - Frontend dependencies
- ✅ `backend/.env.example` - Environment variable template
- ✅ `.gitignore` - Excludes `.env` and `node_modules`

---

## 🚀 Step 2: Create Railway Account

### 2.1 Sign Up
1. Go to [railway.app](https://railway.app)
2. Click **"Start a New Project"** or **"Login"**
3. Choose **"Login with GitHub"**
4. Authorize Railway to access your GitHub account

### 2.2 Verify Account
1. After logging in, go to **Account Settings**
2. Click **"Add Payment Method"**
3. Enter your credit/debit card details
   - ⚠️ This is required for the $5 free credit
   - You won't be charged unless you exceed $5/month
4. Verify your email address

✅ You should now see **$5.00 credit** in your account!

---

## 🗄️ Step 3: Deploy MySQL Database

### 3.1 Create Database Service
1. Click **"New Project"**
2. Name it: `project-arkanghel`
3. Click **"Deploy MySQL"** or **"Add Service"** → **"Database"** → **"MySQL"**

### 3.2 Wait for Deployment
- Railway will automatically provision a MySQL database
- Wait for status to show **"Active"** (takes ~1-2 minutes)

### 3.3 Get Database Credentials
1. Click on the **MySQL service**
2. Go to **"Variables"** tab
3. You'll see these variables (copy them for later):
   - `MYSQL_URL` - Full connection string
   - `MYSQL_HOST` - Database host
   - `MYSQL_PORT` - Database port (usually 3306)
   - `MYSQL_DATABASE` - Database name
   - `MYSQL_USER` - Database username
   - `MYSQL_PASSWORD` - Database password

### 3.4 Import Your Database Schema
1. Install MySQL client locally (if not installed):
   ```bash
   # Windows (using Chocolatey)
   choco install mysql-cli
   
   # Or download MySQL Workbench from mysql.com
   ```

2. Connect to Railway MySQL:
   ```bash
   mysql -h [MYSQL_HOST] -P [MYSQL_PORT] -u [MYSQL_USER] -p[MYSQL_PASSWORD] [MYSQL_DATABASE]
   ```

3. Import your database:
   ```bash
   # If you have a SQL dump file
   mysql -h [MYSQL_HOST] -P [MYSQL_PORT] -u [MYSQL_USER] -p[MYSQL_PASSWORD] [MYSQL_DATABASE] < your_database.sql
   ```

   **OR** use Railway's built-in MySQL client:
   - Click on MySQL service → **"Data"** tab
   - Click **"Query"** to run SQL commands
   - Copy and paste your database schema

---

## 🔧 Step 4: Deploy Backend (Node.js/Express)

### 4.1 Add Backend Service
1. In your `project-arkanghel` project, click **"New Service"**
2. Choose **"GitHub Repo"**
3. Select your repository: `project-arkanghel`
4. Railway will detect it's a Node.js project

### 4.2 Configure Backend Settings
1. Click on the backend service
2. Go to **"Settings"** tab
3. Set **Root Directory**: `backend`
4. Set **Start Command**: `npm start`
5. Click **"Save"**

### 4.3 Set Environment Variables
1. Go to **"Variables"** tab
2. Click **"New Variable"** and add each of these:

```env
# Database Configuration (use values from MySQL service)
DB_HOST=your_mysql_host_from_step_3
DB_USER=your_mysql_user_from_step_3
DB_PASSWORD=your_mysql_password_from_step_3
DB_NAME=your_mysql_database_from_step_3
DB_PORT=3306

# Server Configuration
PORT=8081
NODE_ENV=production

# JWT Secret (generate a random string)
JWT_SECRET=your_super_secret_jwt_key_change_this_to_random_string

# Azure AD Configuration (from your .env file)
AZURE_CLIENT_ID=your_azure_client_id
AZURE_TENANT_ID=your_azure_tenant_id
AZURE_CLIENT_SECRET=your_azure_client_secret
AZURE_REDIRECT_URI=https://your-backend-url.railway.app/auth/callback

# Email Configuration (from your .env file)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=your_email@gmail.com

# Frontend URL (we'll update this after deploying frontend)
FRONTEND_URL=https://your-frontend-url.railway.app
```

**Important Notes:**
- Replace all `your_*` values with actual values
- For `JWT_SECRET`, generate a random string (at least 32 characters)
- We'll update `AZURE_REDIRECT_URI` and `FRONTEND_URL` after getting the actual URLs

### 4.4 Link Database to Backend
1. In backend service, go to **"Variables"** tab
2. Click **"Reference"** → Select your MySQL service
3. Railway will automatically add database connection variables

### 4.5 Deploy Backend
1. Railway will automatically deploy after you save variables
2. Wait for deployment to complete (~2-3 minutes)
3. Check **"Deployments"** tab for status
4. Once deployed, go to **"Settings"** → **"Networking"**
5. Click **"Generate Domain"** to get a public URL
6. Copy this URL (e.g., `https://your-backend.up.railway.app`)

---

## 🎨 Step 5: Deploy Frontend (React/Vite)

### 5.1 Add Frontend Service
1. In your project, click **"New Service"**
2. Choose **"GitHub Repo"**
3. Select the same repository
4. Railway will detect it's a Node.js project

### 5.2 Configure Frontend Settings
1. Click on the frontend service
2. Go to **"Settings"** tab
3. Set **Root Directory**: `frontend`
4. Set **Build Command**: `npm run build`
5. Set **Start Command**: `npm run preview`
6. Click **"Save"**

### 5.3 Set Environment Variables
1. Go to **"Variables"** tab
2. Add this variable:

```env
VITE_API_URL=https://your-backend-url.railway.app
```

Replace with your actual backend URL from Step 4.5

### 5.4 Deploy Frontend
1. Railway will automatically deploy
2. Wait for deployment (~2-3 minutes)
3. Go to **"Settings"** → **"Networking"**
4. Click **"Generate Domain"**
5. Copy the frontend URL (e.g., `https://your-frontend.up.railway.app`)

---

## 🔄 Step 6: Update Configuration

### 6.1 Update Backend Environment Variables
1. Go back to **Backend service** → **"Variables"**
2. Update these variables with actual URLs:
   ```env
   FRONTEND_URL=https://your-frontend-url.railway.app
   AZURE_REDIRECT_URI=https://your-backend-url.railway.app/auth/callback
   ```
3. Click **"Save"** - Backend will redeploy automatically

### 6.2 Update Azure AD Redirect URIs
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App Registrations**
3. Select your app
4. Go to **Authentication**
5. Add these Redirect URIs:
   - `https://your-backend-url.railway.app/auth/callback`
   - `https://your-frontend-url.railway.app`
6. Click **"Save"**

### 6.3 Update Frontend API URL (if using hardcoded URLs)
If your frontend has hardcoded `localhost:8081` URLs:

1. Go to your local code
2. Find and replace all instances:
   ```javascript
   // OLD
   const API_URL = 'http://localhost:8081';
   
   // NEW
   const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';
   ```

3. Commit and push:
   ```bash
   git add .
   git commit -m "Update API URL for production"
   git push
   ```

4. Railway will auto-deploy the changes

---

## ✅ Step 7: Verify Deployment

### 7.1 Test Database Connection
1. Go to **Backend service** → **"Logs"**
2. Look for successful database connection messages
3. If errors, check database credentials in variables

### 7.2 Test Backend API
1. Open your backend URL in browser: `https://your-backend.railway.app`
2. Try accessing: `https://your-backend.railway.app/health` (if you have a health endpoint)
3. Check logs for any errors

### 7.3 Test Frontend
1. Open your frontend URL: `https://your-frontend.railway.app`
2. Try logging in with Azure AD
3. Test all major features:
   - ✅ Login/Logout
   - ✅ View modules
   - ✅ Take assessments
   - ✅ Admin dashboard
   - ✅ Leaderboard

### 7.4 Check Logs
If anything doesn't work:
1. Go to each service → **"Logs"** tab
2. Look for error messages
3. Common issues:
   - CORS errors → Check `FRONTEND_URL` in backend
   - Database errors → Check database credentials
   - 404 errors → Check API URL in frontend

---

## 🔧 Step 8: Troubleshooting

### Issue: CORS Errors
**Solution:**
1. Check backend `FRONTEND_URL` matches your actual frontend URL
2. Ensure backend CORS middleware allows your frontend domain
3. Check browser console for specific CORS error

### Issue: Database Connection Failed
**Solution:**
1. Verify all database credentials in backend variables
2. Check MySQL service is running (should show "Active")
3. Try connecting to database manually using MySQL client

### Issue: Frontend Shows "Network Error"
**Solution:**
1. Check `VITE_API_URL` in frontend variables
2. Ensure backend is deployed and running
3. Check backend logs for errors

### Issue: Azure AD Login Not Working
**Solution:**
1. Verify `AZURE_REDIRECT_URI` in backend matches Azure portal
2. Check Azure portal has correct redirect URIs added
3. Ensure `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET` are correct

### Issue: Email Notifications Not Sending
**Solution:**
1. Check `EMAIL_USER` and `EMAIL_PASSWORD` are correct
2. Ensure you're using an App Password (not regular Gmail password)
3. Check backend logs for email errors

---

## 💰 Step 9: Monitor Usage

### 9.1 Check Credit Usage
1. Go to Railway dashboard
2. Click on your account (top right)
3. View **"Usage"** to see current month's spending
4. Typical usage: $3-4/month for this project

### 9.2 Set Up Alerts (Optional)
1. Go to **Account Settings**
2. Set up email alerts when usage reaches certain thresholds
3. Recommended: Alert at $4 (80% of free credit)

---

## 🎓 Step 10: Custom Domain (Optional)

If you want a custom domain instead of `.railway.app`:

### 10.1 Add Custom Domain
1. Go to **Frontend service** → **"Settings"** → **"Networking"**
2. Click **"Custom Domain"**
3. Enter your domain (e.g., `arkanghel.yourdomain.com`)
4. Follow DNS configuration instructions
5. Railway will automatically provision SSL certificate

### 10.2 Update Configuration
1. Update `FRONTEND_URL` in backend variables
2. Update Azure AD redirect URIs
3. Redeploy services

---

## 📚 Useful Railway Commands

### View Logs
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# View logs
railway logs
```

### Redeploy Service
1. Go to service → **"Deployments"**
2. Click **"Redeploy"** on latest deployment

### Rollback Deployment
1. Go to service → **"Deployments"**
2. Find previous working deployment
3. Click **"⋮"** → **"Redeploy"**

---

## 🎉 Deployment Complete!

Your Project Arkanghel is now live on Railway! 🚀

**Your URLs:**
- Frontend: `https://your-frontend.railway.app`
- Backend: `https://your-backend.railway.app`
- Database: Managed by Railway (internal)

**Next Steps:**
1. Share your frontend URL with users
2. Monitor usage and logs
3. Set up monitoring/alerts
4. Consider custom domain for professional look

---

## 📞 Need Help?

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Project Issues:** Check service logs first
- **Database Issues:** Use Railway's MySQL client in "Data" tab

---

## 🔄 Making Updates

When you make code changes:

1. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your update message"
   git push
   ```

2. Railway will automatically detect changes and redeploy
3. Check **"Deployments"** tab to monitor progress
4. Changes will be live in ~2-3 minutes

---

**Good luck with your deployment! 🎓**
