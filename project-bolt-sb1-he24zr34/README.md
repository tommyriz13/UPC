# Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` inside the `project` directory and fill in your Supabase credentials:
   ```bash
   cp project/.env.example project/.env
   # edit project/.env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   ```

3. Start the dev server:
   ```bash
   npm run --prefix project dev
   ```

4. Open the provided URL in your browser.
