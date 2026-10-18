# CallPilot — AI Cold Call Assistant

CallPilot is a web-based assistant designed to help sales representatives structure cold calls, record prospect responses, track conversation progress, and receive AI-powered coaching.

## Live Demo

- **Frontend:** https://call-pilot-rouge.vercel.app/
- **Backend Health:** https://callpilot-1.onrender.com/health
- **Repository:** https://github.com/RushiKohak/CallPilot

## Features

- Structured cold-call workflow with eight stages
- Create and manage calls with prospect or company names
- Record selected responses and the prospect's actual words
- Save call progress and retrieve call history
- Record call outcomes and next steps
- AI-powered coaching suggestions using Ollama Cloud
- Persistent storage using Supabase
- Deployed frontend and backend

## Call Stages

1. Opening
2. Purpose
3. Permission
4. Their business
5. Their need
6. Objection
7. Next step
8. Close

## Tech Stack

**Frontend:** React, Vite, JavaScript, CSS

**Backend:** Node.js, Express.js

**Database:** Supabase (PostgreSQL)

**AI:** Ollama Cloud (`gpt-oss:20b`)

**Deployment:** Vercel (frontend), Render (backend)

## Project Structure

```text
CallPilot/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

## Local Setup

### Prerequisites

- Node.js and npm
- A Supabase project
- An Ollama Cloud API key for AI coaching

### 1. Clone the repository

```bash
git clone https://github.com/RushiKohak/CallPilot.git
cd CallPilot
```

### 2. Configure the database

Run the SQL in `database/schema.sql` in the Supabase SQL Editor.

### 3. Configure the backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
PORT=5000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SECRET_KEY=your_supabase_secret_key
OLLAMA_API_KEY=your_ollama_api_key
```

Never commit real credentials or secret keys.

Start the backend:

```bash
npm start
```

The backend runs on port 5000 locally.

### 4. Configure the frontend

In a separate terminal:

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://localhost:5000
```

Start the frontend:

```bash
npm run dev
```

Open the local URL printed by Vite in your browser.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Check backend and database connectivity |
| POST | `/api/calls` | Create a call |
| GET | `/api/calls` | Retrieve call history |
| POST | `/api/calls/:id/stages` | Save call-stage progress |
| POST | `/api/calls/:id/close` | Close a call and save its outcome |
| POST | `/api/coach` | Generate AI coaching suggestions |

## Environment Variables

| Variable | Purpose |
|---|---|
| `PORT` | Backend port; defaults to 5000 |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Private Supabase key used by the backend |
| `OLLAMA_API_KEY` | API key for Ollama Cloud |
| `VITE_API_URL` | Backend URL used by the frontend |

The Supabase secret and Ollama API key must remain server-side. Do not expose them through frontend variables or commit them to GitHub.

## Current Deployment

The application is deployed on Vercel and Render, with Supabase used for persistent storage. Verify the live links before relying on them, because free hosting services may take time to wake up.

## Author

**Rushi Kohak**

GitHub: https://github.com/RushiKohak
