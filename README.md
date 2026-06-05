# ☁️ CloudVault

CloudVault is a secure, modern, full-stack cloud storage web application built using the MERN stack (MongoDB, Express, React, Node.js). It provides users with a personal vault to upload, organize, manage, and share files in a clean, intuitive dashboard interface.

---

## 🚀 Features

- **🔒 Secure Authentication:**
  - JWT (JSON Web Token) based user registration and login.
  - Password hashing via `bcryptjs`.
  - Protected API routes and front-end route guards.

- **📁 Folder Organization:**
  - Create, view, and delete folders.
  - Nested directories support (folders within folders) with dynamic breadcrumb navigation.
  - Keep track of the current path path seamlessly.

- **📤 File Uploads:**
  - High-performance, robust file uploading powered by `multer`.
  - Cloud-based storage utilizing **Cloudinary** integration via `multer-storage-cloudinary`.
  - Support for various file formats (images, documents, PDFs, etc.) with size tracking.

- **🔗 Sharing System:**
  - Generate unique, secure sharing links for files.
  - Public viewing and downloading interface (`/share/:shareCode`) accessible without authentication.
  - Easy-to-manage sharing state (toggle share on/off).

- **🎨 Modern Responsive UI:**
  - Clean layout featuring sidebar navigation and search.
  - Detailed files list showing file type icons, name, upload date, size, and actions.
  - Real-time toast notifications for user interactions.

---

## 🛠️ Tech Stack

### Backend
- **Node.js** & **Express.js** — Fast, opinionated, minimalist web framework.
- **MongoDB** & **Mongoose** — Document-based database with object modeling.
- **Cloudinary** — Media APIs and cloud storage for files.
- **Multer** — Middleware for handling `multipart/form-data` uploads.
- **JSON Web Tokens (JWT)** — For secure stateless authentication.

### Frontend
- **React.js** (Vite) — Core user interface framework.
- **React Router DOM v7** — Client-side routing.
- **Axios** — HTTP client for API requests (configured with JWT interceptor).
- **Lucide React** — Modern, consistent icon library.
- **CSS3 (Vanilla)** — Highly customized, responsive design system.

---

## 📂 Project Structure

```text
cloudvault/
├── backend/
│   ├── config/          # Database & Cloudinary configurations
│   ├── middleware/      # Auth & Error handling middlewares
│   ├── models/          # Mongoose Schemas (User, Folder, File)
│   ├── routes/          # Express API route handlers (auth, files, folders)
│   ├── server.js        # Entry point for backend
│   └── package.json
│
├── frontend/
│   ├── public/          # Static assets
│   ├── src/
│   │   ├── api/         # Axios instance with interceptors
│   │   ├── components/  # Reusable UI components (Navbar, etc.)
│   │   ├── context/     # React Context API (Auth, Toast)
│   │   ├── hooks/       # Custom React hooks (useToast)
│   │   ├── pages/       # Page components (Dashboard, Login, Register, ShareView)
│   │   ├── App.jsx      # Main router and app component
│   │   └── main.jsx     # Vite entry point
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## ⚙️ Installation & Setup

### Prerequisites
Make sure you have the following installed:
- [Node.js](https://nodejs.org/) (v16+ recommended)
- [MongoDB](https://www.mongodb.com/) (Local or MongoDB Atlas)
- A [Cloudinary](https://cloudinary.com/) account for file hosting

### 1. Clone the Repository
```bash
git clone git@github.com:mumerse24/cloudvault.git
cd cloudvault
```

### 2. Configure Backend
Navigate to the `backend` folder:
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

### 3. Configure Frontend
Navigate to the `frontend` folder:
```bash
cd ../frontend
npm install
```

---

## 🏃 Running the Application

### Start the Backend Server
In the `backend` directory, run:
```bash
npm run dev
```
The server will start on `http://localhost:5000` (or the port specified in your `.env`).

### Start the Frontend Dev Server
In the `frontend` directory, run:
```bash
npm run dev
```
The client will start, usually on `http://localhost:5173`. Open this URL in your browser.

---

## 🔌 API Documentation

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| **POST** | `/api/auth/register` | Register a new user | No |
| **POST** | `/api/auth/login` | Login user & return JWT | No |
| **GET** | `/api/auth/me` | Get authenticated user info | Yes |
| **GET** | `/api/folders` | Get folders in current directory | Yes |
| **POST** | `/api/folders` | Create a new folder | Yes |
| **DELETE** | `/api/folders/:id` | Delete a folder | Yes |
| **GET** | `/api/files` | Get files in current directory | Yes |
| **POST** | `/api/files/upload` | Upload a file to Cloudinary | Yes |
| **DELETE** | `/api/files/:id` | Delete a file from Cloudinary & DB | Yes |
| **POST** | `/api/files/:id/share` | Enable/Disable file sharing | Yes |
| **GET** | `/api/files/share/:shareCode` | Publicly retrieve shared file | No |

---

## 🛠️ Git & Deployment Commands

To push this repository to GitHub for the first time:

```bash
# Initialize git in the root folder
git init

# Add all files to staging (uses root .gitignore)
git add .

# Commit changes
git commit -m "Initial commit: Set up CloudVault MERN Stack Project"

# Rename branch to main
git branch -M main

# Link remote origin
git remote add origin git@github.com:mumerse24/cloudvault.git

# Push to origin
git push -u origin main
```
