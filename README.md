# RelAI Platform

A comprehensive AI-powered workplace intelligence platform with authentication, knowledge base management, and AI clone functionality.

## Project Structure

This project is organized into two main directories:

### Frontend (`/frontend`)
- **Framework**: Next.js 16 with TypeScript
- **Styling**: Tailwind CSS with custom animations
- **Authentication**: Supabase integration
- **Features**: Modern SaaS authentication page with black/white theme

### Backend (`/backend`)
- **Framework**: Express.js with Node.js
- **Features**: RESTful API endpoints, CORS, security headers
- **Database**: Prepared for Supabase integration
- **Endpoints**: Health check, users, knowledge bases, AI clones

## Quick Start

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npm run dev
```

## Environment Setup

1. **Supabase Setup**:
   - Create a Supabase project
   - Get your URL and anon key
   - Add to `frontend/.env.local` and `backend/.env`

2. **Frontend Environment** (`frontend/.env.local`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. **Backend Environment** (`backend/.env`):
   ```
   PORT=5000
   SUPABASE_URL=your-supabase-url
   SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

## Features

### Current Features
- ✅ Modern authentication page (login/signup)
- ✅ Black and white theme with glassmorphism
- ✅ Responsive single-column layout
- ✅ Basic Express API server
- ✅ Project structure for scalability

### Planned Features
- 🔄 User dashboard and profile management
- 🔄 Knowledge base creation and management
- 🔄 AI clone creation and training
- 🔄 File upload and processing
- 🔄 Real-time collaboration features
- 🔄 Advanced analytics and reporting

## Development

- Frontend runs on `http://localhost:3000`
- Backend runs on `http://localhost:5000`
- Both services can be developed independently

## Contributing

1. Frontend changes: Work in `/frontend` directory
2. Backend changes: Work in `/backend` directory
3. Follow the existing code style and patterns
4. Test both frontend and backend changes

## License

This project is part of Hack Canada 2024.

---

## RelAI UI/UX Redesign & Theme Configuration

The frontend has been upgraded with a highly polished, premium SaaS UI featuring dark-first theming, custom glassmorphism, and responsive components.

### Environment Variables
To run the full stack successfully, ensure your `frontend/.env.local` contains:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_API_URL=http://localhost:5000  # Points to the backend Express server (default)
```

### Customizing the Theme
The look and feel is explicitly controlled by modern Tailwind CSS v4 variables to ensure a sleek and strict design system. To tweak colors, spacing, or element radiuses:
- Edit **`frontend/src/app/globals.css`**: Adjust core design tokens like `--color-background`, `--color-primary`, or `--radius-md`.
- **UI Components**: Modify specific structural or animating primitives located in `frontend/src/components/ui/`.