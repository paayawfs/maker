# Maker / Party Matchmaker

A real-time matchmaking application for events, designed to help attendees meet relevant people by answering questions and getting matched.

## Tech Stack

### Frontend
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State/Auth**: Supabase Client

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **Language**: Python 3.12+
- **Database**: Supabase (PostgreSQL)
- **Server**: Uvicorn

## Prerequisites

- Node.js (v18+)
- Python (v3.10+)
- Supabase Account

## Getting Started

### 1. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Create and activate a virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file in the `backend` directory (see [Environment Variables](#environment-variables)).

Run the development server:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://127.0.0.1:8000`. API docs are at `/docs`.

### 2. Frontend Setup

Navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create a `.env.local` file in the `frontend` directory (if custom configuration is needed).

Run the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Environment Variables

### Backend (`backend/.env`)

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
```

### Frontend (`frontend/.env.local`)

Required if you are not using the defaults in `src/lib/api.ts` or need to override them.

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000  # Default is often inferred or hardcoded in dev
```
