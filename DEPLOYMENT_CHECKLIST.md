# 🚀 Railway Deployment Checklist

Use this checklist to ensure you complete all deployment steps correctly.

---

## ✅ Pre-Deployment Checklist

- [ ] Code is working locally (frontend + backend + database)
- [ ] All changes committed to Git
- [ ] Project pushed to GitHub
- [ ] `.env` files are in `.gitignore` (NOT pushed to GitHub)
- [ ] You have a GitHub account
- [ ] You have a credit/debit card for Railway verification

---

## ✅ Railway Account Setup

- [ ] Created Railway account at [railway.app](https://railway.app)
- [ ] Logged in with GitHub
- [ ] Added payment method (for $5 free credit)
- [ ] Verified email address
- [ ] Confirmed $5.00 credit is showing in account

---

## ✅ Database Deployment

- [ ] Created new Railway project named `project-arkanghel`
- [ ] Deployed MySQL database service
- [ ] Database status shows "Active"
- [ ] Copied database credentials:
  - [ ] `MYSQL_HOST`
  - [ ] `MYSQL_PORT`
  - [ ] `MYSQL_USER`
  - [ ] `MYSQL_PASSWORD`
  - [ ] `MYSQL_DATABASE`
- [ ] Imported database schema to Railway MySQL
- [ ] Verified tables exist in Railway database

---

## ✅ Backend Deployment

- [ ] Added backend service from GitHub repo
- [ ] Set root directory to `backend`
- [ ] Set start command to `npm start`
- [ ] Added all environment variables:
  - [ ] `DB_HOST`
  - [ ] `DB_USER`
  - [ ] `DB_PASSWORD`
  - [ ] `DB_NAME`
  - [ ] `DB_PORT`
  - [ ] `PORT=8081`
  - [ ] `NODE_ENV=production`
  - [ ] `JWT_SECRET` (generated random string)
  - [ ] `AZURE_CLIENT_ID`
  - [ ] `AZURE_TENANT_ID`
  - [ ] `AZURE_CLIENT_SECRET`
  - [ ] `AZURE_REDIRECT_URI`
  - [ ] `EMAIL_USER`
  - [ ] `EMAIL_PASSWORD`
  - [ ] `EMAIL_FROM`
  - [ ] `FRONTEND_URL`
- [ ] Linked MySQL database to backend service
- [ ] Backend deployed successfully (check Deployments tab)
- [ ] Generated public domain for backend
- [ ] Copied backend URL: `_______________________________`
- [ ] Backend is accessible (test in browser)

---

## ✅ Frontend Deployment

- [ ] Added frontend service from GitHub repo
- [ ] Set root directory to `frontend`
- [ ] Set build command to `npm run build`
- [ ] Set start command to `npm run preview`
- [ ] Added environment variable:
  - [ ] `VITE_API_URL` (with backend URL)
- [ ] Frontend deployed successfully
- [ ] Generated public domain for frontend
- [ ] Copied frontend URL: `_______________________________`
- [ ] Frontend is accessible (test in browser)

---

## ✅ Configuration Updates

- [ ] Updated backend `FRONTEND_URL` with actual frontend URL
- [ ] Updated backend `AZURE_REDIRECT_URI` with actual backend URL
- [ ] Backend redeployed after variable updates
- [ ] Updated Azure AD redirect URIs in Azure Portal:
  - [ ] Added `https://your-backend.railway.app/auth/callback`
  - [ ] Added `https://your-frontend.railway.app`
- [ ] Updated frontend code to use `import.meta.env.VITE_API_URL`
- [ ] Committed and pushed frontend changes
- [ ] Frontend auto-redeployed

---

## ✅ Testing & Verification

- [ ] Backend logs show no errors
- [ ] Database connection successful (check backend logs)
- [ ] Frontend loads without errors
- [ ] Can access frontend URL in browser
- [ ] Azure AD login works
- [ ] Can view modules/workstreams
- [ ] Can take assessments
- [ ] Admin features work
- [ ] Leaderboard displays
- [ ] Email notifications work (test one)
- [ ] No CORS errors in browser console
- [ ] All API calls successful

---

## ✅ Post-Deployment

- [ ] Documented backend URL
- [ ] Documented frontend URL
- [ ] Set up usage alerts in Railway (optional)
- [ ] Shared URLs with team/instructor
- [ ] Tested all major features end-to-end
- [ ] Created backup of database (optional)

---

## 📝 Important URLs

Write down your deployed URLs here:

**Backend URL:** `https://___________________________________`

**Frontend URL:** `https://___________________________________`

**Railway Project:** `https://railway.app/project/___________`

---

## 🆘 Common Issues & Solutions

### ❌ CORS Error
- ✅ Check `FRONTEND_URL` in backend matches actual frontend URL
- ✅ Ensure no trailing slash in URLs
- ✅ Check backend CORS middleware configuration

### ❌ Database Connection Failed
- ✅ Verify all DB credentials in backend variables
- ✅ Check MySQL service is "Active"
- ✅ Ensure database is linked to backend service

### ❌ Frontend Shows Blank Page
- ✅ Check browser console for errors
- ✅ Verify `VITE_API_URL` is set correctly
- ✅ Check frontend build completed successfully

### ❌ Azure Login Not Working
- ✅ Verify redirect URIs in Azure Portal
- ✅ Check `AZURE_REDIRECT_URI` in backend
- ✅ Ensure all Azure credentials are correct

### ❌ 404 Not Found
- ✅ Check API URL in frontend code
- ✅ Verify backend routes are correct
- ✅ Check backend is deployed and running

---

## 💡 Tips

- **Check logs first** - Most issues show up in service logs
- **Redeploy if needed** - Sometimes a fresh deploy fixes issues
- **Test locally first** - Ensure everything works locally before deploying
- **One service at a time** - Deploy and verify each service before moving to next
- **Save URLs** - Keep track of all your Railway URLs

---

## 📊 Expected Monthly Cost

Based on your application:
- **Database:** ~$1.50/month
- **Backend:** ~$1.50/month
- **Frontend:** ~$0.50/month
- **Total:** ~$3.50/month (well within $5 free credit)

---

**Deployment Status:** 
- [ ] Not Started
- [ ] In Progress
- [ ] Completed ✅

**Deployment Date:** _______________

**Deployed By:** _______________

---

Good luck! 🎉
