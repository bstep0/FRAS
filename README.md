
# Facial Recognition Attendance System

An end‑to‑end web application that automates classroom attendance using facial recognition.

---

## 📑 Table of Contents
1. [Key Features](#key-features)  
2. [Tech Stack](#tech-stack)  
3. [Getting Started](#getting-started)  
4. [Local Development](#local-development)  
5. [Deployment](#deployment)    
6. [Authors & Acknowledgements](#authors--acknowledgements)

---

## Key Features
* **Fast face scanning** and ≥ 90 % recognition accuracy.
* **Role‑based dashboards** — Students, Teachers, and Admins each get scoped views.  
* **Firebase Firestore** persistence with server‑side rules.   

---

## Tech Stack
| Layer | Technology | Hosting |
|-------|------------|---------|
| Frontend | **React** JSX + Vite + CSS | **Firebase Hosting** |
| Backend | **Flask** REST API + DeepFace | **Render** |
| Face Recognition | **OpenCV + DeepFace** |
| Database | **Firebase Firestore** |
| Auth | Firebase Auth |

---

## Getting Started

### Prerequisites
* **Node.js** ≥ 18 LTS  
* **Python** ≥ 3.10  
* **Firebase CLI** ≥ 12  
* **Git**

### Clone & Bootstrap
```bash
git clone https://github.com/bstep00/FacialRecognitionAttendanceSystem.git
cd face-attendance
```

Create the following environment files:

**`backend/.env`**
```env
FIREBASE_CREDENTIALS=firebase_credentials.json
FIREBASE_PROJECT_ID=your-project-id
```

**`frontend/.env`**
```env
VITE_API_BASE=https://facialrecognitionattendancesystem.onrender.com/api/face-recognition
VITE_FIREBASE_API_KEY=***
VITE_FIREBASE_AUTH_DOMAIN=***
```

Install backend dependencies:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # (or venv\Scripts\activate on Windows)
pip install -r requirements.txt
```

Install frontend dependencies:
```bash
cd frontend
npm install
```

---

## Local Development

### Backend
```bash
cd backend
flask --app app run --reload
```

### Frontend
```bash
cd frontend
npm run dev
```

---

## Deployment

### Backend → Render
1. **Create a new Web Service** in Render.  
2. **Connect** your GitHub repo and select the `/backend` directory as the root.  
3. **Environment:** `Python 3`, start command `python app.py`.  
4. Add environment variables from `backend/.env`.  
5. Every push to `main` automatically redeploys.

### Frontend → Firebase Hosting
```bash
# one‑time setup
firebase init hosting
# each deploy
npm run build
firebase deploy --only hosting
```

---

## Authors & Acknowledgements
| Name | Role |
|------|------|
| **Brendon Stepanek** |
| **Zain Jamal** | 
| **Joshua Odegai** |
| **Maximiliano Hernandez** |
| **Neel Patel** |

Special thanks to **Prof. Diana Rabah** for sponsorship and guidance.

---
