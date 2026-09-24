# SancharNetra Portal - Latest Documentation

**CDR & IPDR Analysis Platform for Law Enforcement**
*Version: 1.1 (Patched)*

## 1. Prerequisites (Windows)
- **Node.js** (v14+): [Download here](https://nodejs.org/)
- **MongoDB** (v4.4+): [Download here](https://www.mongodb.com/try/download/community)
  *(During installation, ensure "Install MongoDB as a Service" is checked).*

## 2. Quick Setup & Run (Windows)
We've provided a PowerShell script that automates the installation and booting process for Windows machines.
1. Right-click `setup-and-run.ps1` and select **Run with PowerShell**.
2. The script will automatically:
   - Install backend dependencies.
   - Install frontend dependencies.
   - Start the MongoDB Service.
   - Launch the Backend Server on Port `8080`.
   - Launch the Frontend UI and automatically open your browser to `http://localhost:3000`.

## 3. Importing Intelligence Databases
To correctly analyze numbers and emails, you MUST import the intelligence datasets located in your root directory. Open your terminal in the `server` folder and run the following three commands:
```bash
cd server

# 1. Import CollegeDekho Data
MONGO_URI="mongodb://127.0.0.1:27017/CDR_Visualizer" node scripts/importBreachTxt.js ../COLLEGEDEKHO.COM.txt CollegeDekho_2024

# 2. Import UPPCL Data
MONGO_URI="mongodb://127.0.0.1:27017/CDR_Visualizer" node scripts/importBreachCsv.js ../uppcl_db.csv UPPCL_2022

# 3. Import Instagram OSINT Data (Warning: Very Large, May take 1-2 hours)
MONGO_URI="mongodb://127.0.0.1:27017/CDR_Visualizer" node scripts/importInstagramJson.js ../Instagram.json Instagram_Leak_2024
```
*(Note: Because of our graceful degradation patch, if external intelligence APIs fail, your local database intelligence will still seamlessly render on the Frontend).*

## 4. User Features Overview

### Call Detail Records (CDR)
- Under **Data Upload**, select your case and upload CDR CSV files.
- Go to **CDR Analysis** to view network visualizations, call stats, and timelines.

### Internet Protocol Detail Records (IPDR) & VPN/Tor
- Upload IPDR logs from ISPs.
- **IPDR Analysis** will automatically flag connections routed through Tor, major VPNs (NordVPN, ExpressVPN, Proton, etc.), and Cloud Datacenters.

### WhatsApp Call Correlation
1. Go to **WhatsApp/VoIP** tab in IPDR Analysis.
2. Enter the subject's **IMSI** (15 digits).
3. The system will correlate timestamped packets moving to WhatsApp relay servers to deduce the exact Party B IMSI on the other end of the call, generating a structural confidence score (Green/Yellow/Red).

### Intelligence Profiling
- Enter a Phone number, Email, or Username (Instagram).
- The system checks both external APIs (which elegantly timeout if rate-limited) and your local MongoDB Intelligence imports (`Instagram`, `UPPCL`, `CollegeDekho`), compiling a unified threat dossier.

---
*Developed by Team AlgoRhythm*
