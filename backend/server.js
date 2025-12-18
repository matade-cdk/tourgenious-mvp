const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const bodyParser = require('body-parser');
const translationPatterns = require('./translationPatterns');

// Free translation providers (no API key required)
const FREE_TRANSLATE_URL = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com/translate';

async function libreTranslate(text, fromCode, toCode) {
  const response = await axios.post(
    FREE_TRANSLATE_URL,
    { q: text, source: fromCode, target: toCode, format: 'text' },
    { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  return response.data?.translatedText;
}

async function myMemoryTranslate(text, fromCode, toCode) {
  const response = await axios.get('https://api.mymemory.translated.net/get', {
    params: { q: text, langpair: `${fromCode}|${toCode}` },
    timeout: 15000
  });
  return response.data?.responseData?.translatedText;
}

// Offline chatbot fallback so users always get a response
function generateOfflineChatbotResponse(message = '') {
  const lower = message.toLowerCase();
  const canned = [];

  if (lower.includes('beach')) {
    canned.push('Top Goa beaches: Baga (nightlife), Calangute (water sports), Anjuna (sunsets), Palolem (peaceful). Go early for parking and bring cash for shacks.');
  }
  if (lower.includes('hotel') || lower.includes('stay') || lower.includes('resort')) {
    canned.push('For stays: North Goa = nightlife (Baga/Calangute), Candolim/Sinquerim = quieter, Anjuna/Vagator = cafes. South Goa = peaceful (Palolem/Agonda/Colva). Book via TourGenious lodging to see verified listings.');
  }
  if (lower.includes('weather')) {
    canned.push('Goa weather: Oct-Feb pleasant (22-32°C), Mar-May hot (30-36°C), Jun-Sep monsoon. Keep a light rain jacket in monsoon and book refundable stays.');
  }
  if (lower.includes('food') || lower.includes('restaurant') || lower.includes('eat')) {
    canned.push('Try Goan dishes: Fish thali, Cafreal, Xacuti, Vindaloo, Bebinca dessert. Ask shacks for today’s fresh catch; avoid plastic waste on beaches.');
  }
  if (lower.includes('transport') || lower.includes('taxi') || lower.includes('cab') || lower.includes('scooter')) {
    canned.push('Getting around: Scooters are fastest for short hops; carry license and helmet. For airport → hotel, pre-book a taxi. Avoid late-night isolated rides; share live location.');
  }
  if (lower.includes('emergency') || lower.includes('help')) {
    canned.push('Emergency: Dial 112 for police/medical. Keep a copy of your ID. In TourGenious, open Smart Assist → Emergency for quick contacts and location sharing.');
  }

  if (!canned.length) {
    canned.push('I am your Goa Tourism assistant. Ask me about beaches, stays, food, transport, weather, or how to use TourGenious features (booking, translator, smart assist).');
  }

  return canned.join(' ');
}

// Add Google Translate free API (ESM-only package: use dynamic import when needed)
// NOTE: Do NOT call at top-level with require() — it returns an object and breaks at runtime.
async function gtranslate(text, options) {
  const mod = await import('@vitalets/google-translate-api');
  return mod.default(text, options);
}

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Simple in-memory rate limiter for the chatbot endpoint
const chatbotRateLimitStore = new Map(); // key: IP, value: { count, resetAt }
const CHATBOT_WINDOW_MS = 60 * 1000; // 1 minute window
const CHATBOT_MAX_REQUESTS = 50; // increased max requests per window per IP

// Provider (Gemini) cooldown to avoid hammering when rate limited
let chatbotProviderCooldownUntil = 0; // timestamp in ms - reset for testing
const CHATBOT_PROVIDER_COOLDOWN_MS = 1 * 1000; // reduced to 1 second

function chatbotRateLimiter(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  let entry = chatbotRateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + CHATBOT_WINDOW_MS };
    chatbotRateLimitStore.set(key, entry);
  }

  if (entry.count >= CHATBOT_MAX_REQUESTS) {
    const retryAfterMs = Math.max(entry.resetAt - now, 0);
    return res.status(429).json({
      error: 'Too many requests to chatbot. Please try again shortly.',
      rateLimited: true,
      retryAfterMs,
      windowMs: CHATBOT_WINDOW_MS
    });
  }

  entry.count += 1;
  next();
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'TourGenious Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// Translation API endpoint (removed rate limiter for testing)
app.post('/api/translate', async (req, res) => {
  const { text, fromLanguage, toLanguage } = req.body;

  // Language code mapping for providers
  const languageMap = {
    'English': 'en',
    'Hindi': 'hi',
    'Konkani': 'gom',
    'Marathi': 'mr'
  };
  const fromCode = languageMap[fromLanguage] || 'en';
  const toCode = languageMap[toLanguage] || 'hi';

  try {

    if (!text || !fromLanguage || !toLanguage) {
      return res.status(400).json({
        error: 'Missing required parameters: text, fromLanguage, toLanguage'
      });
    }

    // 🤖 REAL AI TRANSLATION - Use FREE Google Translate API 
    console.log(`🤖 Using AI to translate "${text}" from ${fromLanguage} to ${toLanguage}`);
    
    const result = await gtranslate(text, { from: fromCode, to: toCode });
    
    if (result && result.text) {
      const translatedText = result.text.trim();
      console.log(`✅ AI translation successful: "${text}" → "${translatedText}"`);
      
      return res.json({
        success: true,
        originalText: text,
        translatedText,
        fromLanguage,
        toLanguage,
        provider: 'google-translate-ai'
      });
    }
    
    throw new Error('No translation result from AI');

  } catch (error) {
    console.log('🔄 AI translation failed, trying backup...', error.message);
    const providerStatus = error?.response?.status;

    // Try OpenRouter (configurable model) when Google free API fails
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const OPENROUTER_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || 'gpt-5.1-codex-max';
        console.log(`Attempting OpenRouter translation with model: ${OPENROUTER_MODEL}`);
        const openrouterResponse = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: OPENROUTER_MODEL,
            messages: [{
              role: 'user',
              content: `Translate this text from ${fromLanguage} to ${toLanguage}. Only return the translation, with no extra words: "${text}"`
            }],
            max_tokens: 128,
            temperature: 0.2
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:5001',
              'X-Title': 'TourGenious Translator'
            }
          }
        );
        if (openrouterResponse.data?.choices?.[0]?.message?.content) {
          const translatedText = openrouterResponse.data.choices[0].message.content.trim();
          return res.json({
            success: true,
            originalText: text,
            translatedText,
            fromLanguage,
            toLanguage,
            provider: `openrouter:${OPENROUTER_MODEL}`
          });
        }
      } catch (openrouterError) {
        console.log('OpenRouter translation failed:', openrouterError.response?.data || openrouterError.message);
      }
    }

    // Next: completely free providers (no key)
    try {
      console.log('Attempting LibreTranslate fallback...');
      const translatedText = await libreTranslate(text, fromCode, toCode);
      if (translatedText) {
        return res.json({
          success: true,
          originalText: text,
          translatedText: translatedText.trim(),
          fromLanguage,
          toLanguage,
          provider: 'libretranslate'
        });
      }
    } catch (ltErr) {
      console.log('LibreTranslate failed:', ltErr.response?.data || ltErr.message);
    }

    try {
      console.log('Attempting MyMemory fallback...');
      const translatedText = await myMemoryTranslate(text, fromCode, toCode);
      if (translatedText) {
        return res.json({
          success: true,
          originalText: text,
          translatedText: translatedText.trim(),
          fromLanguage,
          toLanguage,
          provider: 'mymemory'
        });
      }
    } catch (mmErr) {
      console.log('MyMemory translate failed:', mmErr.response?.data || mmErr.message);
    }
    
    if (providerStatus === 429) {
      console.warn('Translation provider rate limit hit (429). Returning fallback translation.');
      chatbotProviderCooldownUntil = Date.now() + CHATBOT_PROVIDER_COOLDOWN_MS;
    } else {
      console.error('Translation API Error:', error.message);
    }
    
    // Enhanced fallback translations for common phrases
    const fallbackTranslations = {
      'English-Hindi': {
        'Hello': 'नमस्ते',
        'Hi': 'नमस्ते', 
        'How are you?': 'आप कैसे हैं?',
        'What is your name?': 'आपका नाम क्या है?',
        'what is your name': 'आपका नाम क्या है',
        'What is your name': 'आपका नाम क्या है',
        'My name is': 'मेरा नाम है',
        'Nice to meet you': 'आपसे मिलकर खुशी हुई',
        'Thank you': 'धन्यवाद',
        'Thanks': 'धन्यवाद',
        'Good morning': 'सुप्रभात',
        'Good afternoon': 'नमस्ते',
        'Good evening': 'शुभ संध्या',
        'Good night': 'शुभ रात्रि',
        'Welcome': 'स्वागत है',
        'Please': 'कृपया',
        'Sorry': 'माफ़ कीजिए',
        'Excuse me': 'माफ़ करें',
        'Yes': 'हाँ',
        'No': 'नहीं',
        'Where is': 'कहाँ है',
        'Where are you from?': 'आप कहाँ से हैं?',
        'How much': 'कितना',
        'How old are you?': 'आपकी उम्र क्या है?',
        'I love you': 'मैं तुमसे प्यार करता हूँ',
        'Beautiful': 'सुंदर',
        'Delicious': 'स्वादिष्ट',
        'Help': 'मदद',
        'Water': 'पानी',
        'Food': 'खाना',
        'Beach': 'समुद्र तट',
        'Hotel': 'होटल',
        'Airport': 'हवाई अड्डा',
        'Station': 'स्टेशन',
        'Hospital': 'अस्पताल',
        'Police': 'पुलिस',
        'Market': 'बाज़ार',
        'Restaurant': 'रेस्टोरेंट',
        'Taxi': 'टैक्सी',
        'Bus': 'बस',
        'Train': 'रेल',
        'Money': 'पैसा',
        'Time': 'समय',
        'Today': 'आज',
        'Tomorrow': 'कल',
        'Yesterday': 'कल (बीता हुआ)',
        // Quick phrases from UI
        'Good morning': 'सुप्रभात',
        'How are you?': 'आप कैसे हैं?',
        'Where is': 'कहाँ है',
        'How much': 'कितना',
        'Beautiful': 'सुंदर',
        'Delicious': 'स्वादिष्ट'
      },
      'English-Konkani': {
        'Hello': 'नमस्कार',
        'Hi': 'नमस्कार',
        'How are you?': 'तुमी कशे आसात?',
        'What is your name?': 'तुझे नांव कितें?',
        'what is your name': 'तुझे नांव कितें',
        'What is your name': 'तुझे नांव कितें',
        'My name is': 'म्हजे नांव',
        'Nice to meet you': 'तुका भेटून बरे दिसले',
        'Thank you': 'धन्यवाद',
        'Thanks': 'धन्यवाद',
        'Good morning': 'सुप्रभात',
        'Good afternoon': 'दनपारां बरे',
        'Good evening': 'सांजे बरे',
        'Good night': 'शुभ रात्रि',
        'Welcome': 'स्वागत',
        'Please': 'कृपया',
        'Sorry': 'माफ करात',
        'Excuse me': 'माफ करात',
        'Yes': 'हांय',
        'No': 'ना',
        'Where is': 'कुत्र आसा',
        'Where are you from?': 'तूं कुत्रां',
        'How much': 'किती',
        'How old are you?': 'तुझे वर्स किती?',
        'I love you': 'हांव तुका मोग करतां',
        'Beautiful': 'सुंदर',
        'Delicious': 'रुचीक',
        'Help': 'आदार',
        'Water': 'उदक',
        'Food': 'जेवण',
        'Beach': 'किनारो',
        'Hotel': 'धर्मशाळा',
        'Airport': 'विमानतळ',
        'Station': 'स्थानक',
        'Hospital': 'रुग्णालय',
        'Police': 'पोलीस',
        'Market': 'बाजार',
        'Restaurant': 'जेवणघर',
        'Taxi': 'टॅक्सी',
        'Bus': 'बस',
        'Train': 'रेल्व',
        'Money': 'पैसे',
        'Time': 'वेळ',
        'Today': 'आयज',
        'Tomorrow': 'फाल्यां',
        'Yesterday': 'काल',
        // Quick phrases from UI
        'Good morning': 'सुप्रभात',
        'How are you?': 'तुमी कशे आसात?',
        'Where is': 'कुत्र आसा',
        'How much': 'किती',
        'Beautiful': 'सुंदर',
        'Delicious': 'रुचीक'
      },
      'English-Marathi': {
        'Hello': 'नमस्कार',
        'Hi': 'नमस्कार',
        'How are you?': 'तुम्ही कसे आहात?',
        'What is your name?': 'तुमचे नाव काय?',
        'what is your name': 'तुमचे नाव काय',
        'What is your name': 'तुमचे नाव काय',
        'My name is': 'माझे नाव',
        'Nice to meet you': 'तुम्हाला भेटून आनंद झाला',
        'Thank you': 'धन्यवाद',
        'Thanks': 'धन्यवाद', 
        'Good morning': 'सुप्रभात',
        'Good afternoon': 'नमस्कार',
        'Good evening': 'शुभ संध्या',
        'Good night': 'शुभ रात्रि',
        'Welcome': 'स्वागत आहे',
        'Please': 'कृपया',
        'Sorry': 'माफ करा',
        'Excuse me': 'माफ करा',
        'Yes': 'होय',
        'No': 'नाही',
        'Where is': 'कुठे आहे',
        'Where are you from?': 'तुम्ही कुठचे आहात?',
        'How much': 'किती',
        'How old are you?': 'तुमचे वय किती?',
        'I love you': 'मी तुझ्यावर प्रेम करतो',
        'Beautiful': 'सुंदर',
        'Delicious': 'चविष्ट',
        'Help': 'मदत',
        'Water': 'पाणी',
        'Food': 'अन्न',
        'Beach': 'समुद्रकिनारा',
        'Hotel': 'हॉटेल',
        'Airport': 'विमानतळ',
        'Station': 'स्थानक',
        'Hospital': 'रुग्णालय',
        'Police': 'पोलीस',
        'Market': 'बाजार',
        'Restaurant': 'जेवणघर',
        'Taxi': 'टॅक्सी',
        'Bus': 'बस',
        'Train': 'रेल्वे',
        'Money': 'पैसे',
        'Time': 'वेळ',
        'Today': 'आज',
        'Tomorrow': 'उद्या',
        'Yesterday': 'काल',
        // Quick phrases from UI
        'Good morning': 'सुप्रभात',
        'How are you?': 'तुम्ही कसे आहात?',
        'Where is': 'कुठे आहे',
        'How much': 'किती',
        'Beautiful': 'सुंदर',
        'Delicious': 'चविष्ट'
      }
    };

    // Enhanced AI-like translation logic
    console.log('DEBUG: About to start enhanced translation logic');
    console.log('DEBUG: Starting enhanced translation logic');
    const key = `${fromLanguage}-${toLanguage}`;
    const translationMap = fallbackTranslations[key];
    
    let translatedText = text;
    console.log(`DEBUG: Looking for ${key} translations for "${text}"`);
    if (translationMap) {
      // First try exact match
      if (translationMap[text]) {
        translatedText = translationMap[text];
      } else {
        // Try case-insensitive match
        const lowerText = text.toLowerCase();
        const exactKey = Object.keys(translationMap).find(key => key.toLowerCase() === lowerText);
        if (exactKey) {
          translatedText = translationMap[exactKey];
        } else {
          // Smart AI-like word-by-word translation using patterns
          const words = text.toLowerCase().split(/\s+/);
          const translations = [];
          let hasTranslations = false;
          
          for (const word of words) {
            // Check translation patterns first for more comprehensive coverage
            const patternKey = `${fromLanguage}-${toLanguage}`;
            const patterns = translationPatterns[patternKey];
            console.log(`DEBUG: Checking pattern for "${word}" in ${patternKey}:`, patterns ? 'found' : 'not found');
            
            if (patterns && patterns[word]) {
              console.log(`DEBUG: Found translation for "${word}": ${patterns[word]}`);
              translations.push(patterns[word]);
              hasTranslations = true;
            } else if (translationMap) {
              // Check if word exists in our fallback translations
              const foundKey = Object.keys(translationMap).find(key => 
                key.toLowerCase().includes(word) || word.includes(key.toLowerCase())
              );
              if (foundKey) {
                translations.push(translationMap[foundKey]);
                hasTranslations = true;
              } else {
                translations.push(word);
              }
            } else {
              translations.push(word);
            }
          }
          
          if (hasTranslations) {
            translatedText = translations.join(' ');
          }
        }
      }
    }

    res.json({
      success: true,
      originalText: text,
      translatedText,
      fromLanguage,
      toLanguage,
      fallback: true,
      message: providerStatus === 429 ? 'Rate limited. Using fallback translation.' : 'Using fallback translation'
    });
  }
});

// Weather API endpoint
app.get('/api/weather/:city', async (req, res) => {
  try {
    const { city } = req.params;
    
    if (!city) {
      return res.status(400).json({
        error: 'City parameter is required'
      });
    }

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`
    );

    const weatherData = response.data;
    
    res.json({
      success: true,
      city: weatherData.name,
      country: weatherData.sys.country,
      temperature: Math.round(weatherData.main.temp),
      feelsLike: Math.round(weatherData.main.feels_like),
      description: weatherData.weather[0].description,
      icon: weatherData.weather[0].icon,
      humidity: weatherData.main.humidity,
      pressure: weatherData.main.pressure,
      windSpeed: weatherData.wind.speed,
      clouds: weatherData.clouds.all,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Weather API Error:', error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        error: 'City not found',
        message: 'Please check the city name and try again'
      });
    }
    
    res.status(500).json({
      error: 'Failed to fetch weather data',
      message: 'Please try again later'
    });
  }
});

// Weather API endpoint with coordinates
app.get('/api/weather/coords/:lat/:lon', async (req, res) => {
  try {
    const { lat, lon } = req.params;
    
    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Latitude and longitude parameters are required'
      });
    }

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`
    );

    const weatherData = response.data;
    
    res.json({
      success: true,
      city: weatherData.name,
      country: weatherData.sys.country,
      temperature: Math.round(weatherData.main.temp),
      feelsLike: Math.round(weatherData.main.feels_like),
      description: weatherData.weather[0].description,
      icon: weatherData.weather[0].icon,
      humidity: weatherData.main.humidity,
      pressure: weatherData.main.pressure,
      windSpeed: weatherData.wind.speed,
      clouds: weatherData.clouds.all,
      coordinates: { lat: weatherData.coord.lat, lon: weatherData.coord.lon },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Weather API Error (coordinates):', error.message);
    
    res.status(500).json({
      error: 'Failed to fetch weather data',
      message: 'Please try again later'
    });
  }
});

// Chatbot API endpoint (removed rate limiter for testing)
app.post('/api/chatbot', async (req, res) => {
  try {
    const { message, context = 'travel' } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    // Reset cooldown for testing
    chatbotProviderCooldownUntil = 0;

    // Cooldown check removed - always try API

    // Add small delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 150));

    // Primary: OpenRouter GPT-5.1-Codex-Max (configurable)
    if (process.env.OPENROUTER_API_KEY) {
      const OPENROUTER_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || 'gpt-5.1-codex-max';
      try {
        const openrouterResponse = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: OPENROUTER_MODEL,
            messages: [
              {
                role: 'system',
                content: 'You are a Goa Tourism AI Assistant for TourGenious. Only answer about Goa travel and TourGenious app features. Be concise and helpful.'
              },
              { role: 'user', content: message }
            ],
            max_tokens: 300,
            temperature: 0.6
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:5001',
              'X-Title': 'TourGenious Chatbot'
            }
          }
        );

        if (openrouterResponse.data?.choices?.[0]?.message?.content) {
          const botResponse = openrouterResponse.data.choices[0].message.content.trim();
          return res.json({
            success: true,
            message: botResponse,
            context,
            provider: `openrouter:${OPENROUTER_MODEL}`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (orErr) {
        console.log('OpenRouter chatbot failed, falling back to Gemini:', orErr.response?.data || orErr.message);
      }
    }

    // Fallback: Gemini
    const travelPrompt = `You are a Goa Tourism AI Assistant for TourGenious app. You can ONLY help with:
    1. Goa tourism, destinations, attractions, beaches, culture, food, weather, and travel tips
    2. TourGenious app features like booking, emergency services, translator, events, and smart assist modules
    \nIf someone asks about anything outside of Goa tourism or app features, politely respond: "I'm a Goa Tourism AI Assistant and can only help with Goa-related travel information and TourGenious app features. How can I assist you with your Goa travel plans?"\nKeep responses helpful, concise, and focused only on Goa or app functionality.\nUser message: "${message}"\nResponse:`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [ { parts: [ { text: travelPrompt } ] } ],
        generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const botResponse = response.data.candidates[0].content.parts[0].text.trim();
      return res.json({ success: true, message: botResponse, context, provider: 'gemini-1.5-flash', timestamp: new Date().toISOString() });
    }
    throw new Error('Invalid chatbot response');

  } catch (error) {
    const providerStatus = error?.response?.status;
    
    // Try OpenRouter free models when Gemini fails
    if (providerStatus === 429 || providerStatus >= 500) {
      console.warn(`Gemini chatbot failed (${providerStatus}). Trying OpenRouter free models...`);
      
      if (process.env.OPENROUTER_API_KEY) {
        try {
          const openrouterResponse = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
              model: 'mistralai/mistral-7b-instruct:free',
              messages: [{
                role: 'system',
                content: 'You are a helpful Goa Tourism Assistant. Provide information about Goa beaches, culture, food, and attractions. Keep responses concise and helpful.'
              }, {
                role: 'user',
                content: message
              }],
              max_tokens: 150,
              temperature: 0.7
            },
            {
              headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:5001',
                'X-Title': 'Goa Tourism Chatbot'
              }
            }
          );
          
          if (openrouterResponse.data?.choices?.[0]?.message?.content) {
            const botResponse = openrouterResponse.data.choices[0].message.content.trim();
            return res.json({
              success: true,
              message: botResponse,
              context,
              provider: 'openrouter-llama-free',
              timestamp: new Date().toISOString()
            });
          }
        } catch (openrouterError) {
          console.log('OpenRouter chatbot error details:', openrouterError.response?.data || openrouterError.message);
          console.log('OpenRouter chatbot also failed, using fallback responses...');
        }
      }
    }
    
    if (providerStatus === 429) {
      console.warn('Chatbot provider rate limit hit (429). Returning fallback response.');
      // Set a short cooldown to avoid hammering the provider
      chatbotProviderCooldownUntil = Date.now() + CHATBOT_PROVIDER_COOLDOWN_MS;
    } else {
      console.error('Chatbot API Error:', error.message);
    }
    
    const { context = 'travel' } = req.body;
    const offlineResponse = generateOfflineChatbotResponse(req.body?.message || '');
    
    res.json({
      success: true,
      message: offlineResponse,
      context,
      fallback: true,
      rateLimited: providerStatus === 429,
      provider: 'offline-goa-guide',
      timestamp: new Date().toISOString()
    });
  }
});

// Nearby Places API endpoint (using Overpass API - OpenStreetMap)
app.post('/api/places/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radius, type } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Missing required parameters: latitude, longitude'
      });
    }

    // Use radius in meters (default 5000m = 5km)
    const searchRadius = radius || 5000;
    
    // Map category types to OSM tags
    const typeMapping = {
      'restaurant': 'amenity=restaurant',
      'lodging': 'tourism=hotel',
      'tourist_attraction': 'tourism=attraction',
      'shopping_mall': 'shop',
      'hospital': 'amenity=hospital',
      'transit_station': 'public_transport=station'
    };

    // Build Overpass query - simplified for speed
    let osmQuery = '';
    if (type && type !== 'all' && typeMapping[type]) {
      const tag = typeMapping[type];
      osmQuery = `node[${tag}](around:${searchRadius},${latitude},${longitude});
                  way[${tag}](around:${searchRadius},${latitude},${longitude});`;
    } else {
      // Query main amenities only (faster)
      osmQuery = `node[amenity~"restaurant|cafe|hotel|hospital|atm|bank|pharmacy|fuel"](around:${searchRadius},${latitude},${longitude});
                  node[tourism~"hotel|attraction|museum|viewpoint"](around:${searchRadius},${latitude},${longitude});
                  node[shop~"supermarket|mall|convenience"](around:${searchRadius},${latitude},${longitude});`;
    }

    const overpassQuery = `[out:json][timeout:15];(${osmQuery});out body center 100;`; // Limit to 100 results
    
    // Multiple Overpass API endpoints (try in order if one fails)
    const overpassUrls = [
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass-api.de/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
    ];
    
    let response = null;
    let lastError = null;
    
    // Try each Overpass API endpoint
    for (const overpassUrl of overpassUrls) {
      try {
        console.log(`Trying Overpass API: ${overpassUrl}`);
        response = await axios.post(overpassUrl, `data=${encodeURIComponent(overpassQuery)}`, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000 // 15 second timeout per server
        });
        console.log(`✓ Success with ${overpassUrl}`);
        break; // Success, exit loop
      } catch (error) {
        console.log(`✗ Failed with ${overpassUrl}: ${error.message}`);
        lastError = error;
        continue; // Try next server
      }
    }
    
    // If all servers failed, throw the last error
    if (!response) {
      throw lastError || new Error('All Overpass API servers failed');
    }

    if (response.data && response.data.elements) {
      const places = response.data.elements
        .filter(element => element.tags && element.tags.name)
        .map(element => {
          // Calculate distance using Haversine formula
          const R = 6371; // Earth's radius in km
          const lat = element.lat || (element.center ? element.center.lat : latitude);
          const lon = element.lon || (element.center ? element.center.lon : longitude);
          
          const dLat = (lat - latitude) * Math.PI / 180;
          const dLon = (lon - longitude) * Math.PI / 180;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;

          // Determine category
          let category = 'place';
          if (element.tags.amenity) category = element.tags.amenity;
          else if (element.tags.tourism) category = element.tags.tourism;
          else if (element.tags.shop) category = 'shopping';

          return {
            id: element.id.toString(),
            name: element.tags.name,
            category: category,
            distance: Math.round(distance * 10) / 10,
            address: element.tags['addr:street'] 
              ? `${element.tags['addr:street']}${element.tags['addr:housenumber'] ? ' ' + element.tags['addr:housenumber'] : ''}`
              : element.tags['addr:city'] || 'Near you',
            lat: lat,
            lon: lon,
            phone: element.tags.phone || element.tags['contact:phone'],
            website: element.tags.website || element.tags['contact:website'],
            openingHours: element.tags.opening_hours
          };
        })
        .filter(place => place.distance <= (searchRadius / 1000)); // Filter by radius in km

      // Sort by distance and limit to 50 results
      const sortedPlaces = places
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 50);

      res.json({
        success: true,
        places: sortedPlaces,
        total: sortedPlaces.length
      });
    } else {
      res.json({
        success: true,
        places: [],
        total: 0
      });
    }
  } catch (error) {
    console.error('Nearby places API error:', error.message);
    console.error('Error details:', error.response?.data || error);
    
    res.status(500).json({
      error: 'Failed to fetch nearby places',
      message: error.message,
      details: 'OpenStreetMap Overpass API may be temporarily unavailable. Please try again.'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'The requested API endpoint does not exist'
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong on our end'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TourGenious Backend API running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
