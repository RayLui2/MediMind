# MediMind

AI-powered healthcare assistant for personal health tracking and medical guidance. MediMind combines modern web technologies with AI to provide users with intelligent health monitoring and conversational medical assistance.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Overview

MediMind is a comprehensive full-stack healthcare application that empowers users to take control of their health through:
- **AI-Powered Medical Assistant**: Conversational medical guidance using Google's Gemini AI
- **Health Monitoring Dashboard**: Track vital signs, symptoms, and health metrics with interactive visualizations
- **Medication Management**: Never miss a dose with smart medication tracking and reminders
- **Symptom Logging**: Monitor and track symptoms over time to identify patterns
- **Personalized Insights**: Receive AI-driven health recommendations based on your data
- **Secure Health Records**: User authentication and encrypted health data management

## Features

### Current Features
- **User Authentication**: Secure signup and login with JWT-based authentication
- **AI Chat Interface**: Interactive chat with AI medical assistant powered by Gemini
- **Conversation History**: Save and retrieve past medical conversations
- **Health Dashboard**: Personal health data visualization and tracking with interactive charts
- **Health Metrics Tracking**: Monitor vital signs including blood pressure, heart rate, and weight
- **Symptom Tracker**: Log and track symptoms with severity levels and timestamps
- **Medication Management**: Track medications with reminders, schedules, and daily check-offs
- **Health Profile**: Manage current conditions, allergies, and family history
- **Health Calculators**: Built-in BMI, BMR, water intake, and health risk calculators
- **AI Recommendations**: Personalized health insights and recommendations
- **Responsive Design**: Modern, mobile-friendly UI built with React

### Planned Features
- Appointment scheduling and calendar integration
- Health reports generation and export
- Advanced analytics and trend predictions
- Multi-language support
- Integration with wearable devices and health apps

## Tech Stack

### Frontend
- **React** 19.2.3 - UI framework
- **TypeScript** 4.9.5 - Type-safe JavaScript
- **React Router** 7.11.0 - Client-side routing
- **Axios** 1.13.2 - HTTP client
- **Chart.js** 4.5.1 - Data visualization
- **React Markdown** 9.0.1 - Markdown rendering for AI responses
- **React Testing Library** - Component testing

### Backend
- **FastAPI** 0.104.1 - Modern Python web framework
- **SQLAlchemy** 2.0.23 - SQL toolkit and ORM
- **PostgreSQL** (via psycopg2-binary) - Database
- **Google Gemini AI** - AI chat capabilities
- **JWT Authentication** - Secure token-based auth
- **Uvicorn** - ASGI server

## Project Structure

```
MediMind/
├── frontend/                 # React TypeScript application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   │   ├── Home.tsx     # Landing page
│   │   │   ├── Login.tsx    # Login page
│   │   │   ├── Signup.tsx   # Registration page
│   │   │   ├── Dashboard.tsx # Health dashboard
│   │   │   └── Chat.tsx     # AI chat interface
│   │   ├── services/        # API service layer
│   │   ├── context/         # React context providers
│   │   └── styles/          # CSS/styling files
│   └── package.json
│
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── main.py          # Application entry point
│   │   ├── database.py      # Database configuration
│   │   ├── models/          # SQLAlchemy models
│   │   │   ├── user.py      # User model
│   │   │   ├── conversations.py
│   │   │   └── message.py
│   │   ├── routes/          # API endpoints
│   │   │   ├── auth.py      # Authentication routes
│   │   │   └── chat.py      # Chat routes
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # Business logic
│   │   └── utils/           # Utility functions
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # Environment variables (not in git)
│
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js** 16+ and npm
- **Python** 3.9+
- **PostgreSQL** database (or Supabase account)
- **Google Gemini API** key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/MediMind.git
   cd MediMind
   ```

2. **Backend setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Frontend setup**
   ```bash
   cd frontend
   npm install
   ```

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/medimind

# JWT Secret
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key-here

# CORS
CORS_ORIGINS=http://localhost:3000
```

### Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   The API will be available at `http://localhost:8000`

2. **Start the frontend development server**
   ```bash
   cd frontend
   npm start
   ```

   The application will open at `http://localhost:3000`

## API Documentation

Once the backend is running, visit:
- **Interactive API docs**: http://localhost:8000/docs
- **Alternative docs**: http://localhost:8000/redoc

### Main Endpoints

#### Authentication
- `POST /auth/signup` - Register new user
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user

#### Chat
- `POST /chat/conversations` - Create new conversation
- `GET /chat/conversations` - Get user's conversations
- `POST /chat/messages` - Send message and get AI response
- `GET /chat/conversations/{id}/messages` - Get conversation messages

#### Health
- `GET /health` - Health check endpoint
- `GET /test-db` - Database connection test

## Development

### Database Setup

1. Create the database tables:
   ```bash
   cd backend
   python create_tables.py
   python create_chat_tables.py
   ```

### Running Tests

**Backend tests:**
```bash
cd backend
pytest
# Or run specific test files
python test_schemas.py
python test_security.py
python test_gemini.py
```

**Frontend tests:**
```bash
cd frontend
npm test
```

### Code Quality

The project uses:
- TypeScript for type safety in frontend
- Pydantic for request/response validation in backend
- SQLAlchemy for database ORM
- FastAPI's automatic API documentation

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please ensure your code:
- Follows the existing code style
- Includes appropriate tests
- Updates documentation as needed

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Google Gemini AI for providing the AI chat capabilities
- FastAPI and React communities for excellent documentation
- All contributors who help improve MediMind

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Note**: This application is for informational purposes only and should not replace professional medical advice, diagnosis, or treatment. Always seek the advice of qualified health providers with questions regarding medical conditions.
