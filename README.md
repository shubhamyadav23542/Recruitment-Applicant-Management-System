# TalentFlow - Recruitment & Applicant Management System

A complete, modern, responsive, and fully functional **Recruitment & Applicant Management System (ATS)** built from scratch with **HTML5, CSS3, Vanilla JavaScript, Node.js, Express.js, and SQLite**.

---

## 🚀 Key Features

1. **Dashboard with Real-Time Statistics & Visual Indicators**
   - Live metrics: Total Job Postings, Total Applicants, Pending Reviews, Shortlisted Candidates, Scheduled Interviews, and Rejected Applications.
   - Pure Vanilla SVG Donut Chart representing candidate status breakdown.
   - Interactive Recruitment Pipeline Funnel with percentage progress bars.
   - Applications breakdown by Department.
   - Feed of Recent Applications and upcoming interview agendas.

2. **Job Management**
   - Create, Read, Edit, and Delete job postings.
   - Set status to **Active** (accepting public applications) or **Closed**.
   - Specify Job Title, Department, Location, Salary Range, Employment Type (Full-time, Remote, Contract, etc.), Description, and Requirements.
   - 1-click filter to view all candidates who applied to a specific job.

3. **Candidate Job Application Portal (`apply.html`)**
   - Public-facing careers page accessible without admin login.
   - Dynamic search by job title and department filter.
   - Interactive application form with client-side & server-side validation.
   - PDF Resume Upload with type checking and size limit (max 5 MB).
   - Duplicate submission protection (prevents the same email from applying twice for the same job position).
   - Instant confirmation screen with application receipt.

4. **Resume Management**
   - Secure PDF upload and storage on the server in `uploads/resumes/`.
   - Connected directly to applicant and application profiles.
   - In-browser PDF preview and download capabilities for recruiters.

5. **Application Screening & Status Workflow**
   - 6 Standard Recruitment Stages:
     1. `Pending`
     2. `Under Review`
     3. `Shortlisted`
     4. `Interview Scheduled`
     5. `Selected`
     6. `Rejected`
   - Recruiter feedback and evaluation notes logged with each status transition.

6. **Shortlisting System**
   - 1-click Shortlist/Remove button (`★` / `☆`).
   - Dedicated **Shortlist View** tab for quick decision-making on top talent.
   - Synchronizes candidate pipeline state automatically.

7. **Interview Scheduling**
   - Schedule interviews with Date, Time, Location/Link (e.g., Google Meet, Zoom, On-site Room), and Interview Type (Initial HR Screen, Technical Round, System Design, Final Round).
   - Automatically moves candidate status to `Interview Scheduled`.
   - Filter by status (`Scheduled`, `Completed`, `Cancelled`, `Rescheduled`) or view "Upcoming Only".
   - 1-click action to mark an interview completed or cancelled.

8. **Comprehensive Candidate Database & Profiles**
   - Filterable candidate database with name, email, phone, education, skills, and total applications filed.
   - Complete Dossier Viewer displaying education, skills tags, professional experience, uploaded resumes, cover notes, recruiter notes, and interview histories.

9. **Live Search and Multi-Criteria Filtering**
   - Real-time search across applicants, job postings, and interviews.
   - Filter applications by job, status, skills, shortlist flag, and date range (`date_from` to `date_to`).

10. **Modern, Responsive UI**
    - Professional Royal Blue, Crisp White, and Light-Grey color scheme.
    - Off-canvas collapsible sidebar for mobile and tablet devices.
    - Clean toast notifications, interactive modals, and confirmation dialogs before destructive deletions.

---

## 📁 Project Structure

```
recruitment-system/
├── public/
│   ├── index.html           # Admin Dashboard & Management System
│   ├── login.html           # Admin Authentication Page
│   ├── apply.html           # Public Candidate Careers & Application Portal
│   ├── css/
│   │   └── style.css        # Clean, modern, responsive CSS stylesheet
│   └── js/
│       ├── app.js           # Auth check, router, API client, toasts, modals
│       ├── dashboard.js     # Stats, visual progress bars, SVG donut chart
│       ├── jobs.js          # Job postings CRUD, filters, status toggling
│       ├── applicants.js    # Candidate dossier, profile viewer, edit
│       ├── applications.js  # Screening, status updates, shortlist toggle
│       └── interviews.js    # Interview scheduling, calendar list, status
├── uploads/
│   └── resumes/             # Uploaded PDF resumes directory
├── database/
│   ├── database.js          # SQLite connection, schema setup & seeding
│   └── recruitment.db       # SQLite database file (auto-generated)
├── routes/
│   ├── auth.js              # Admin login & session verification
│   ├── jobs.js              # Jobs REST API endpoints
│   ├── applicants.js        # Applicants REST API endpoints
│   ├── applications.js      # Applications & resume upload REST API
│   ├── interviews.js        # Interviews REST API endpoints
│   └── dashboard.js         # Recruitment statistics & analytics API
├── middleware/
│   └── authMiddleware.js    # JWT verification middleware
├── server.js                # Express.js application entry point
├── package.json             # Project dependencies and npm scripts
└── README.md                # Running instructions & documentation
```

---

## 🛠️ Prerequisites & Installation

### 1. Requirements
- **Node.js** (v18.0.0 or higher recommended, e.g. v20 LTS).
- **npm** (comes bundled with Node.js).

If Node.js is not yet installed on your system, download and install it from:
👉 [https://nodejs.org/](https://nodejs.org/)

### 2. Setup in Visual Studio Code
1. Open Visual Studio Code.
2. Click **File** → **Open Folder...** and select the `recruitment-system` directory:
   ```
   C:\Users\yadav\.gemini\antigravity\scratch\recruitment-system
   ```
3. Open a terminal in VS Code (**Terminal** → **New Terminal** or press ``Ctrl + ` ``).

### 3. Install Dependencies
Run the following command in the terminal to install all required packages:
```bash
npm install
```

Installed dependencies:
- `express` - Fast, minimalist web framework for Node.js
- `sqlite3` - SQLite database engine with parameterized queries
- `multer` - Multipart/form-data handler for PDF resume uploads
- `bcryptjs` - Password hashing for secure admin authentication
- `jsonwebtoken` - JWT token creation and verification for admin routes
- `cors` - Cross-Origin Resource Sharing middleware

### 4. Database Initialization
The database initializes automatically when the server runs.
You can also run database initialization manually to create tables and seed default jobs:
```bash
node database/database.js
```

### 5. Start the Backend Server
Run:
```bash
npm start
```
Or for development with automatic restarts:
```bash
npm run dev
```

You will see:
```text
=======================================================
🚀 Recruitment & Applicant Management System running!
📡 Local Server URL: http://localhost:3000
👤 Admin Dashboard: http://localhost:3000/login.html
📝 Candidate Application Portal: http://localhost:3000/apply.html
🔑 Default Admin Credentials: admin@recruitment.com / admin123
=======================================================
```

---

## 🌐 Application URLs & Credentials

| Page | URL | Purpose |
| :--- | :--- | :--- |
| **Admin Dashboard** | `http://localhost:3000/login.html` | Recruitment dashboard, job management, candidate screening, interviews |
| **Candidate Portal** | `http://localhost:3000/apply.html` | Public portal to view open positions and submit applications |

### Default Admin Credentials:
- **Email:** `admin@recruitment.com` *(or username: `admin`)*
- **Password:** `admin123`

*(Note: The login page includes a convenient "⚡ Click to auto-fill credentials" button for quick testing).*

---

## 🧪 Testing the End-to-End Recruitment Workflow

Follow this complete step-by-step test workflow:

### Step 1: Create a Job Posting
1. Log in to the Admin Dashboard (`http://localhost:3000/login.html`).
2. Go to the **Job Postings** tab (`#jobs`).
3. Click **+ Add New Job**.
4. Fill in:
   - **Title:** `Cloud Solutions Architect`
   - **Department:** `Infrastructure`
   - **Location:** `Remote / Austin, TX`
   - **Salary Range:** `$135,000 - $165,000 / year`
   - **Job Type:** `Full-time`
   - **Status:** `Active`
   - **Description:** `Lead cloud infrastructure and high-availability systems.`
5. Click **Save Job Posting**. Confirm it appears in the table with 0 applicants.

### Step 2: Submit a Candidate Application with Resume Upload
1. Open the Candidate Portal in a new tab: `http://localhost:3000/apply.html`.
2. Notice your newly created job `Cloud Solutions Architect` listed in the openings.
3. Click **Apply for this Position →**.
4. Fill out the application form:
   - **Candidate Name:** `Alexander Vance`
   - **Email:** `alexander.vance@example.com`
   - **Phone:** `+1 (555) 432-8765`
   - **Education:** `M.S. in Computer Engineering - Georgia Tech`
   - **Skills:** `AWS, Kubernetes, Terraform, Docker, Python, Go, CI/CD`
   - **Work Experience:** `6 years building scalable distributed architectures and microservices.`
   - **Resume:** Select a `.pdf` file (max 5 MB).
5. Click **Submit Application Now →**.
6. Verify the green confirmation card: *"Application Successfully Received!"*.
7. *(Optional)* Try submitting the same form again with the same email and job to verify that duplicate applications are prevented.

### Step 3: Application Screening
1. Return to the Admin Dashboard (`http://localhost:3000`).
2. Notice the Dashboard statistics immediately updated (+1 Total Applicant, +1 Pending Screening).
3. Navigate to the **Applications** tab (`#applications`).
4. Find Alexander Vance's application.
5. Click **📄 View PDF** to verify the uploaded resume opens directly in a new tab.
6. Click **👁️ Details** to view the candidate's full profile and educational qualifications.
7. Click **🔄 Status** and change the screening status from `Pending` to `Under Review`. Enter review notes: *"Impressive cloud architecture background. Matches all senior requirements."*
8. Click **Update Application Status**.

### Step 4: Shortlist the Candidate
1. On Alexander Vance's row, click the **☆ Shortlist** button.
2. The button immediately turns purple: **★ Shortlisted**.
3. Click the **Shortlist** tab in the sidebar (`#shortlist`).
4. Confirm Alexander Vance appears in the dedicated shortlist table.

### Step 5: Schedule an Interview
1. On the shortlisted row (or from the **Interviews** tab), click **📅 Interview**.
2. Select:
   - **Date:** Tomorrow's date
   - **Time:** `11:00 AM`
   - **Interview Round:** `Technical Round`
   - **Meeting Details:** `Google Meet (meet.google.com/ats-demo-meet)`
   - **Notes:** `Focus on distributed systems design and Kubernetes deployment strategies.`
3. Click **Save Interview**.
4. Verify the application status automatically updates to `Interview Scheduled`.
5. Check the **Dashboard** and **Interviews** tabs to see the upcoming scheduled interview listed in the agenda.

### Step 6: Final Candidate Decision
1. In the **Interviews** tab, click **✓ Done** to mark the interview as `Completed`.
2. In the **Applications** tab, click **🔄 Status** and set the status to `Selected`.
3. Check the **Dashboard** to see the candidate pipeline visual progress bar reflect the selected hire!

---

## 🔒 Security & Data Integrity Highlights

- **Parameterized Queries:** All SQLite interactions use parameterized SQL statements to prevent SQL injection vulnerabilities.
- **Foreign Key Constraints:** Enabled SQLite foreign keys with cascade deletions to maintain referential integrity.
- **Admin Password Hashing:** Uses `bcryptjs` salt rounds for secure authentication.
- **Protected Routes:** All administrative API endpoints require a verified JWT bearer token.
- **MIME & File Validation:** Multer strictly validates file types (`application/pdf`) and enforces a 5MB size limit to prevent server disk overflow.
- **Duplicate Prevention:** SQLite unique constraints and pre-insertion checks prevent duplicate submissions for the same job and email address.
