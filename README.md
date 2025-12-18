# TourGenious – Travel App (MVP)

A full‑stack travel assistant MVP built with Next.js (frontend) and Express (backend). It includes user dashboards, booking, events, translator, weather, nearby places, and an AI chatbot with multiple fallback providers.

## Table of Contents 📚
- 🧭 [Overview](#overview)
- 🛠 [Tech Stack](#tech-stack)
- 🧱 [Project Structure](#project-structure)
- ✅ [Prerequisites](#prerequisites)
- ⚙️ [Setup](#setup-step-by-step)
- ▶️ [Run the App](#run-the-app)
- 📜 [Available Scripts](#available-scripts)
- 🔌 [API Endpoints](#api-endpoints-backend)
- 🚀 [Deployment Notes](#deployment-notes)
- 🛟 [Troubleshooting](#troubleshooting)

## Overview ✨
TourGenious provides:
- Clean UI with dark mode and responsive design
- AI-powered translator with multiple fallback providers (Google Translate, OpenRouter, LibreTranslate, MyMemory)
- Smart chatbot with offline Goa tourism guidance
- Real-time weather data and nearby places discovery
- User dashboard with booking, events, and emergency features

## Tech Stack 💻
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express, Axios, dotenv, CORS
- **External APIs**: Google Translate, OpenRouter, LibreTranslate, MyMemory, Gemini, OpenWeather, Overpass (OpenStreetMap)

## Project Structure 🧱
```
/ (root)
├─ backend/              # Express API server
├─ frontend/             # Next.js app
└─ README.md
```

## Prerequisites ✅
- Node.js 18+ (Node 20/22 also fine)
- npm 8+
- Two terminals (one for backend, one for frontend)

## Setup (Step by Step) ⚙️

### 1) Clone and install dependencies
```bash
# clone your repo first, then:
cd "MVP TRAVEL/backend"
npm install

cd "../frontend"
npm install
```

### 2) Configure backend environment
Create `backend/.env` and set your keys:
```env
GEMINI_API_KEY=YOUR_GEMINI_KEY
OPENWEATHER_API_KEY=YOUR_OPENWEATHER_KEY
OPENROUTER_API_KEY=YOUR_OPENROUTER_KEY_OPTIONAL
OPENROUTER_DEFAULT_MODEL=gpt-5.1-codex-max
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

**Notes:**
- All API keys live in the backend only. The frontend calls the backend.
- OpenRouter key is optional but recommended for better translations
- We've added rate limiting and multiple fallback providers for reliability.

### 3) Frontend configuration
The frontend automatically connects to `http://localhost:5001/api` in development. For production, set `NEXT_PUBLIC_API_URL` if needed.

## Run the App ▶️
Open two terminals and run backend and frontend separately:

```bash
# Terminal 1 (Backend)
cd "MVP TRAVEL/backend"
npm start

# Terminal 2 (Frontend)
cd "MVP TRAVEL/frontend"
npm run dev
```

- **Backend**: http://localhost:5001
- **Frontend**: http://localhost:3000

## Available Scripts 📜

### Backend (in backend/):
- `npm start` – run Express API
- `npm run dev` – run with nodemon (hot reload)

### Frontend (in frontend/):
- `npm run dev` – start Next.js dev server
- `npm run build` – build for production
- `npm start` – start Next.js in production mode (after build)

## API Endpoints (Backend) 🔌
Base URL: `http://localhost:5001/api`

### Health
- `GET /health` – server status check

### Translation (Multi-provider fallback)
- `POST /translate` 
  ```json
  {
    "text": "Hello world",
    "fromLanguage": "English",
    "toLanguage": "Hindi"
  }
  ```
  **Providers**: Google Translate → OpenRouter → LibreTranslate → MyMemory → Offline patterns

### Chatbot (AI + Offline fallback)
- `POST /chatbot`
  ```json
  {
    "message": "Tell me about Goa beaches",
    "context": "travel"
  }
  ```
  **Providers**: OpenRouter → Gemini → Offline Goa guide

### Weather
- `GET /weather/:city`
- `GET /weather/coords/:lat/:lon`

### Nearby Places (OpenStreetMap)
- `POST /places/nearby`
  ```json
  {
    "latitude": 15.2993,
    "longitude": 74.1240,
    "radius": 5000,
    "type": "all"
  }
  ```

## Deployment Notes 🚀
- Keep all API keys in backend `.env` only
- Set `FRONTEND_URL` in backend for CORS in production
- Set `NEXT_PUBLIC_API_URL` in frontend if backend URL differs
- All providers have fallbacks, so the app works even without paid APIs

## Troubleshooting 🛟

### Translation not working:
- Check backend is running on port 5001
- Verify API keys in backend `.env`
- Translation works offline with built-in patterns as final fallback

### Chatbot issues:
- Ensure `GEMINI_API_KEY` or `OPENROUTER_API_KEY` in backend `.env`
- Offline Goa guide provides responses when APIs fail
- Rate limits return helpful fallback responses

### CORS errors:
- Confirm `FRONTEND_URL` matches your frontend origin in backend `.env`

### Weather issues:
- Verify `OPENWEATHER_API_KEY` in backend `.env`
- Check city name spelling or coordinates format

---

🎉 **Enjoy building with TourGenious!** 

The app is designed to be resilient - even without external API keys, core features like translation and chatbot will work with offline fallbacks.
