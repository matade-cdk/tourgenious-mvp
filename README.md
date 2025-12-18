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
TourGenious is a comprehensive travel companion app that provides:

### 🌐 Multi-Language Support (4 Languages)
- **English**: Primary interface language
- **Hindi**: Full translation support with voice
- **Konkani**: Local Goan language support
- **Marathi**: Regional language integration
- Real-time voice translation between all supported languages

### 🔤 AI Translation Module
- **Multi-Provider Fallback**: Google Translate → OpenRouter → LibreTranslate → MyMemory → Offline patterns
- **Voice Translation**: Speak and hear translations instantly
- **Offline Support**: Works without internet using built-in phrase patterns
- **Quick Phrases**: Pre-loaded common travel phrases
- **Text-to-Speech**: Native pronunciation in all 4 languages

### 🏨 Booking System
- **Hotel/Accommodation Search**: Find and book stays
- **Activity Bookings**: Reserve tours, experiences, and attractions
- **Real-time Availability**: Live booking status and confirmations
- **Price Comparison**: Best deals across multiple providers
- **Booking Management**: View, modify, and cancel reservations
- **Payment Integration**: Secure booking transactions

### 🎉 Events Module
- **Local Events Discovery**: Find festivals, concerts, and cultural events
- **Event Calendar**: Visual calendar with event scheduling
- **Event Details**: Complete information with photos and descriptions
- **RSVP System**: Register for events and get updates
- **Event Categories**: Filter by music, culture, food, adventure, nightlife
- **Location-Based Events**: Events near your current location

### 🗺️ Interactive Map & Places
- **Nearby Places Discovery**: Real-time location-based search
- **Advanced Filters**: 
  - By category (restaurants, hotels, attractions, shopping, hospitals)
  - By distance (1km, 5km, 10km radius)
  - By rating and reviews
  - By price range
- **OpenStreetMap Integration**: Detailed maps with real-time data
- **Place Details**: Photos, reviews, contact info, opening hours
- **Navigation**: Direct integration with map apps
- **Offline Maps**: Basic functionality without internet

### 🤖 Smart Assistant & Chatbot
- **Goa Tourism Expert**: AI-powered local knowledge
- **Multi-Provider AI**: OpenRouter → Gemini → Offline responses
- **Contextual Responses**: Travel-specific advice and recommendations
- **Emergency Support**: Quick access to help and contacts
- **Weather Integration**: Real-time weather updates and forecasts

### 👤 User Dashboard Features
- **Profile Management**: Personal preferences and travel history
- **Booking History**: Complete record of past and upcoming bookings
- **Favorite Places**: Save and organize preferred locations
- **Travel Itinerary**: Plan and manage trip schedules
- **Emergency Contacts**: Quick access to local emergency services
- **Settings**: Language preferences, notifications, and app customization

### 🎨 UI/UX Features
- **Dark/Light Mode**: Automatic theme switching
- **Responsive Design**: Optimized for mobile, tablet, and desktop
- **Accessibility**: Screen reader support and keyboard navigation
- **Offline Support**: Core features work without internet connection
- **Fast Performance**: Optimized loading and smooth animations

## Tech Stack 💻
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express.js, Axios, CORS, dotenv
- **Translation APIs**: Google Translate (free), OpenRouter GPT-5.1-Codex-Max, LibreTranslate, MyMemory
- **AI/Chatbot**: OpenRouter, Google Gemini, Offline responses
- **Maps & Places**: OpenStreetMap Overpass API, Geolocation
- **Weather**: OpenWeatherMap API
- **Voice**: Web Speech API (Speech Recognition & Synthesis)
- **Styling**: Custom CSS animations, responsive design
- **State Management**: React Hooks, Context API

## Project Structure 🧱
```
/ (root)
├─ backend/                    # Express API server
│  ├─ server.js               # Main server with all API endpoints
│  ├─ translationPatterns.js  # Offline translation patterns
│  ├─ package.json           # Backend dependencies
│  └─ .env.example           # Environment variables template
├─ frontend/                  # Next.js application
│  ├─ src/
│  │  ├─ app/                # App Router pages
│  │  │  ├─ landing/         # Landing page with navigation
│  │  │  ├─ user-dashboard/  # User dashboard modules
│  │  │  │  ├─ dashboard/    # Main dashboard
│  │  │  │  ├─ booking/      # Booking management
│  │  │  │  ├─ event/        # Events discovery
│  │  │  │  ├─ map/          # Interactive maps
│  │  │  │  ├─ translator/   # Voice translator
│  │  │  │  └─ smart-assist/ # AI chatbot
│  │  │  ├─ admin-dashboard/ # Admin panel
│  │  │  └─ main/           # Public pages
│  │  ├─ components/        # Reusable components
│  │  ├─ contexts/         # React contexts (Theme, Language)
│  │  └─ lib/             # Utilities (API, env config)
│  ├─ public/             # Static assets
│  └─ package.json       # Frontend dependencies
└─ README.md            # Project documentation
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

### 🔤 Translation API (Multi-provider)
- **`POST /translate`** - Translate text between languages
  ```json
  {
    "text": "Hello world",
    "fromLanguage": "English", // English|Hindi|Konkani|Marathi
    "toLanguage": "Hindi"
  }
  ```
  **Response**: `{ success, translatedText, provider, fallback }`
  
  **Providers Chain**: Google Translate → OpenRouter GPT-5.1-Codex-Max → LibreTranslate → MyMemory → Offline patterns

### 🤖 Chatbot API (AI + Offline)
- **`POST /chatbot`** - Smart travel assistant
  ```json
  {
    "message": "Tell me about Goa beaches",
    "context": "travel"
  }
  ```
  **Response**: `{ success, message, provider, fallback }`
  
  **Providers**: OpenRouter → Gemini → Offline Goa tourism guide

### 🌤️ Weather API
- **`GET /weather/:city`** - Weather by city name
- **`GET /weather/coords/:lat/:lon`** - Weather by coordinates
  
  **Response**: Temperature, humidity, description, forecast

### 🗺️ Places & Maps API
- **`POST /places/nearby`** - Discover nearby places
  ```json
  {
    "latitude": 15.2993,
    "longitude": 74.1240,
    "radius": 5000,        // meters
    "type": "restaurant"   // restaurant|hotel|attraction|hospital|shopping
  }
  ```
  **Response**: Array of places with details, distance, ratings

### 🏨 Booking API (Planned)
- **`GET /bookings`** - User's booking history
- **`POST /bookings`** - Create new booking
- **`PUT /bookings/:id`** - Update booking
- **`DELETE /bookings/:id`** - Cancel booking

### 🎉 Events API (Planned)
- **`GET /events`** - Local events list
- **`GET /events/category/:type`** - Filter by event type
- **`POST /events/:id/rsvp`** - RSVP to event

### 🏥 Emergency & Health
- **`GET /health`** - Server health check
- **`GET /emergency/contacts`** - Local emergency numbers
- **`POST /emergency/alert`** - Send emergency alert

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
