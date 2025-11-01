# 🔧 Frontend API URL Update Guide

This guide helps you update your frontend code to use environment variables for the API URL.

---

## 🎯 Why This Is Needed

Currently, your frontend has hardcoded API URLs like:
```javascript
const API_URL = 'http://localhost:8081';
```

For Railway deployment, we need to make this dynamic so it works in both:
- **Development:** `http://localhost:8081`
- **Production:** `https://your-backend.railway.app`

---

## 📝 Step-by-Step Update Process

### Step 1: Use the API Config File

We've created a centralized API configuration file at:
```
frontend/src/config/api.js
```

This file automatically uses the environment variable or falls back to localhost.

### Step 2: Update Your Component Files

Find all files that use `const API_URL = 'http://localhost:8081'` and update them.

#### Example Files to Update:
- `src/pages/employee/E_Modules.jsx`
- `src/pages/employee/ViewModules.jsx`
- `src/pages/admin/A_Modules.jsx`
- And any other files with hardcoded API URLs

#### Before (Old Code):
```javascript
import axios from 'axios';

const API_URL = 'http://localhost:8081';

const E_Modules = () => {
    // ... component code
    
    const api = axios.create({
        baseURL: API_URL,
        withCredentials: true,
        headers: {
            'Content-Type': 'application/json',
        }
    });
    
    // ... rest of code
};
```

#### After (New Code):
```javascript
import axios from 'axios';
import API_URL from '../../config/api'; // Import from config

const E_Modules = () => {
    // ... component code
    
    const api = axios.create({
        baseURL: API_URL,
        withCredentials: true,
        headers: {
            'Content-Type': 'application/json',
        }
    });
    
    // ... rest of code
};
```

**Changes:**
1. Remove: `const API_URL = 'http://localhost:8081';`
2. Add: `import API_URL from '../../config/api';` (adjust path based on file location)

---

## 🔍 Finding Files to Update

### Option 1: Manual Search
1. Open VS Code
2. Press `Ctrl + Shift + F` (Find in Files)
3. Search for: `localhost:8081`
4. Update each file found

### Option 2: Using Command Line
```bash
# Navigate to frontend directory
cd frontend

# Search for files with localhost:8081
grep -r "localhost:8081" src/
```

---

## 📂 Common File Patterns

Based on your project structure, update these patterns:

### Pattern 1: Employee Pages
```javascript
// File: src/pages/employee/E_Modules.jsx
import API_URL from '../../config/api';
```

### Pattern 2: Admin Pages
```javascript
// File: src/pages/admin/A_Modules.jsx
import API_URL from '../../config/api';
```

### Pattern 3: Components
```javascript
// File: src/components/TaskSidebar.jsx
import API_URL from '../config/api';
```

**Note:** Adjust `../../` based on how deep the file is in the folder structure.

---

## ✅ Verification Steps

After updating all files:

### 1. Test Locally (Development)
```bash
cd frontend
npm run dev
```
- Should still connect to `http://localhost:8081`
- All features should work as before

### 2. Test Build
```bash
npm run build
```
- Should build without errors
- Check for any import errors

### 3. Test with Environment Variable
```bash
# Windows PowerShell
$env:VITE_API_URL="https://test-backend.railway.app"
npm run dev

# Windows CMD
set VITE_API_URL=https://test-backend.railway.app
npm run dev
```
- Should connect to the test URL instead of localhost

---

## 🚀 For Railway Deployment

Once all files are updated:

1. **Commit changes:**
   ```bash
   git add .
   git commit -m "Update frontend to use environment variable for API URL"
   git push
   ```

2. **Set environment variable in Railway:**
   - Go to Frontend service → Variables
   - Add: `VITE_API_URL=https://your-backend.railway.app`

3. **Deploy:**
   - Railway will auto-deploy after you push to GitHub
   - Frontend will use the Railway backend URL

---

## 🔧 Alternative: Quick Find & Replace

If you want to update all files at once:

### Using VS Code:
1. Press `Ctrl + Shift + H` (Find and Replace in Files)
2. **Find:** `const API_URL = 'http://localhost:8081';`
3. **Replace with:** `import API_URL from '../../config/api'; // Updated for deployment`
4. Click "Replace All"
5. **Important:** Manually verify each file has the correct import path (`../../` vs `../`)

---

## 📋 Files That Typically Need Updates

Based on your project structure, check these files:

### Employee Pages:
- [ ] `src/pages/employee/E_Modules.jsx`
- [ ] `src/pages/employee/E_Modules_Backup.jsx`
- [ ] `src/pages/employee/ViewModules.jsx`
- [ ] `src/pages/employee/TakeAssessment.jsx`
- [ ] `src/pages/employee/E_Assessment.jsx`
- [ ] `src/pages/employee/E_Dashboard.jsx`

### Admin Pages:
- [ ] `src/pages/admin/A_Modules.jsx`
- [ ] `src/pages/admin/A_Analytics.jsx`
- [ ] `src/pages/admin/A_Leaderboard.jsx`
- [ ] `src/pages/admin/AssessmentEdit.jsx`
- [ ] `src/pages/admin/AssessmentCreate.jsx`
- [ ] `src/pages/admin/WorkstreamEdit.jsx`
- [ ] `src/pages/admin/WorkstreamCreate.jsx`
- [ ] `src/pages/admin/ChapterEdit.jsx`
- [ ] `src/pages/admin/ChapterCreate.jsx`

### Components:
- [ ] `src/components/TaskSidebar.jsx`

---

## 🆘 Troubleshooting

### Error: "Cannot find module '../../config/api'"
**Solution:** Check the import path. Count how many folders deep your file is:
- `src/pages/employee/File.jsx` → `../../config/api`
- `src/components/File.jsx` → `../config/api`
- `src/File.jsx` → `./config/api`

### Error: "API_URL is not defined"
**Solution:** Make sure you imported it:
```javascript
import API_URL from '../../config/api';
```

### Still connecting to localhost in production
**Solution:** 
1. Check Railway environment variable is set: `VITE_API_URL`
2. Rebuild frontend: Railway should auto-rebuild
3. Clear browser cache and reload

---

## 💡 Pro Tip

You can also use the `API_CONFIG` export for axios instances:

```javascript
import axios from 'axios';
import { API_CONFIG } from '../../config/api';

const api = axios.create(API_CONFIG);
```

This automatically includes the baseURL, credentials, and headers.

---

**Need help?** Check the main deployment guide: `RAILWAY_DEPLOYMENT_GUIDE.md`
