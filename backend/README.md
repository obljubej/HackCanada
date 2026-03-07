# RelAI Backend API

Express.js backend server for the RelAI platform.

## Features

- RESTful API endpoints
- CORS enabled
- Security headers with Helmet
- Environment variable configuration
- Error handling middleware
- Health check endpoint

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file (copy from `.env` template)

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Or start the production server:
   ```bash
   npm start
   ```

## API Endpoints

- `GET /` - Welcome message
- `GET /api/health` - Health check
- `GET /api/users` - Users endpoint (placeholder)
- `GET /api/knowledge-bases` - Knowledge bases endpoint (placeholder)
- `GET /api/ai-clones` - AI clones endpoint (placeholder)

## Development

The server runs on port 5000 by default. You can change this in the `.env` file.

## Future Features

- User authentication
- Database integration
- AI clone management
- Knowledge base operations
- File upload handling