# SancharNetra Portal - Quick Start Guide

**Get started in 5 minutes**

---

## Prerequisites

Install these first:
1. **Node.js** (v14+): https://nodejs.org/ 
2. **MongoDB** (v4.4+): https://www.mongodb.com/try/download/community

---

## Installation

### 1. Extract Files
Extract `SancharNetra_Portal.zip` to your desired location.

### 2. Install Dependencies

**Backend:**
```bash
cd server
npm install
```

**Frontend:**
```bash
cd ../client
npm install
```

### 3. Start MongoDB

**Windows:**
```bash
net start MongoDB
```

**macOS:**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongod
```

---

## Running the Application

### Terminal 1 - Backend
```bash
cd server
npm start
```
✓ Wait for: `Backend is running on port 8080!`

### Terminal 2 - Frontend
```bash
cd client
npm start
```
✓ Browser opens at: `http://localhost:3000`

---

## First Steps

### 1. Create a Case
- Click **Case Management** → **Create New Case**
- Fill: Case Number, Name, Officer Name
- Click **Create Case**

### 2. Upload Data
- Go to **Data Upload**
- Select your case
- Upload CDR or IPDR CSV file
- Wait for processing

### 3. Analyze
- **CDR Analysis**: View call records, patterns
- **IPDR Analysis**: See internet activity, WhatsApp calls
- **WhatsApp/VoIP Tab**: Find correlations

---

## WhatsApp Correlation Example

1. Upload IPDR data (must include IMSI field)
2. Go to **IPDR Analysis** → **WhatsApp/VoIP** tab
3. Enter IMSI (15 digits, e.g., 404452991936654)
4. Select case
5. Click **Find Correlations**

**Result:** See WhatsApp calls + Party B matches with confidence scores

---

## Troubleshooting

**MongoDB won't start?**
```bash
# Windows
net start MongoDB

# macOS
brew services restart mongodb-community

# Linux
sudo systemctl restart mongod
```

**Port 8080 in use?**
```bash
# Change port in server/utils/env.js
const port = 8081  // Use different port
```

**No data showing?**
- Check server terminal for errors
- Verify MongoDB is running
- Ensure CSV has correct column headers

---

## Need Help?

📖 **Full Guide:** See `DEPLOYMENT_GUIDE.md`  
🔧 **Troubleshooting:** Check the Troubleshooting section in deployment guide  
📧 **Support:** Contact Team AlgoRhythm

---

**Ready to go!** 🚀
