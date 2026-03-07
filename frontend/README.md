# RelAI Authentication Page

A modern SaaS authentication page for RelAI, an AI-powered workplace intelligence platform.

## Features

- Split-screen layout with branding and auth form
- Login and signup modes with smooth transitions
- Google OAuth integration (placeholder)
- Responsive design for desktop and mobile
- Dark mode support
- Loading states and error handling
- Prepared for Supabase authentication

## Tech Stack

- Next.js 16
- React
- TypeScript
- Tailwind CSS
- Supabase (for auth)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables for Supabase:
   Create a `.env.local` file with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

- Enter email and password to sign in or create an account.
- Toggle between login and signup modes.
- Use the Google sign-in button (requires Supabase setup).
- Links for forgot password and account creation are placeholders.

## Customization

- Update the branding in the left panel.
- Replace placeholders in `handleAuth` and `handleGoogleLogin` with actual Supabase calls.
- Modify styles in Tailwind classes.

## Troubleshooting

- Ensure Supabase keys are set correctly.
- Check console for any runtime errors.
- For production, build with `npm run build`.
