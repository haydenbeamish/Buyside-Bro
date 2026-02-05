# Buy Side Bro

## Overview

Buy Side Bro is a modern financial markets dashboard and portfolio tracker built as a full-stack web application. The platform provides real-time market data visualization, portfolio management, stock analysis with AI insights, earnings calendars, financial news aggregation, and an AI-powered chat assistant. The application fetches market data from an external API (Laser Beam Capital) and uses OpenRouter for AI-powered features.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite for development and production builds
- **Charts**: Recharts for data visualization

### Visual Theme: Neon Green Terminal Aesthetic
- **Color Scheme**: Black background with white text as primary, neon green (#00ff00) for accents/buttons/borders/logos
- **Typography**: Orbitron font for display text (.display-font), JetBrains Mono for data/ticker (.ticker-font)
- **Percentage Colors**: Green (#22c55e) for positive values, red (#ff4444) for negative values
- **Borders**: Green neon borders throughout (border-green-900/30, border-green-500)
- **Buttons**: Transparent background with green border and text (.neon-button)
- **Effects**: Subtle green glow effects on buttons and logo, scanline overlay for terminal feel
- **CSS Classes**: `.neon-green`, `.neon-green-subtle`, `.neon-button`, `.display-font`, `.ticker-font`, `.price-up`, `.price-down`
- **Hero Tagline**: "Don't get ripped off by Bloomberg. I've got you bro."

### Route Structure
- **Landing Page** (`/`): Hero section with scrolling ticker tape, features cards, CTA section, footer
- **Dashboard** (`/dashboard/*`): All authenticated pages use DashboardLayout component with sidebar navigation
  - `/dashboard` or `/dashboard/markets` - Markets data with category tabs
  - `/dashboard/portfolio` - Portfolio tracker
  - `/dashboard/analysis` - Stock analysis with AI
  - `/dashboard/earnings` - Earnings calendar
  - `/dashboard/news` - Financial news feed
  - `/dashboard/chat` - AI chat assistant
  - `/dashboard/subscription` - Subscription management page

### Authentication
- **Provider**: Replit Auth (OpenID Connect) supporting Google, Apple, GitHub, X, and email/password login
- **Auth Routes** (Express, not client routes):
  - `/api/login` - Begin login flow
  - `/api/logout` - Begin logout flow
  - `/api/auth/user` - Get current authenticated user
  - `/api/callback` - OAuth callback handler
- **Session**: PostgreSQL-backed sessions with 7-day TTL
- **Middleware**: `isAuthenticated` middleware for protected routes
- **Client Hook**: `useAuth()` hook provides user, isLoading, isAuthenticated, logout

### Subscription System
- **Provider**: Stripe with stripe-replit-sync for webhook management
- **Pricing**: $10/month with 14-day free trial
- **Product**: "Buy Side Bro Pro" subscription
- **API Endpoints**:
  - `GET /api/subscription/products` - List available products/prices
  - `GET /api/subscription/status` - Get user's subscription status (authenticated)
  - `POST /api/subscription/checkout` - Create Stripe checkout session (authenticated)
  - `POST /api/subscription/portal` - Create customer billing portal session (authenticated)
  - `GET /api/stripe/publishable-key` - Get Stripe publishable key for frontend
  - `POST /api/stripe/webhook` - Stripe webhook endpoint (raw body, before express.json())

The frontend follows a page-based structure with shared components. The application uses a sidebar navigation pattern with responsive design for mobile devices.

### Markets Page Design
The Markets page mirrors the design of laserbeamcapital.com/markets with:
- **Ticker Tape**: Scrolling horizontal ticker at the top showing market names, prices, and 1-day change percentages
- **Category Tabs**: Global Markets, Futures, Commodities, USA Thematics, USA Sectors, USA Equal Weight Sectors, ASX Sectors, Forex
- **Data Table**: Columns for Name, Price, 1D%, 1M%, 1Q%, 1Y%, VS 10D, VS 20D, VS 200D with sortable headers
- **Color Coding**: Green for positive percentages, red for negative
- **Market Summary**: Collapsible section with AI-generated market analysis
- **Dark Theme**: Black background with zinc/gray text hierarchy

### Backend Architecture
- **Framework**: Express.js 5 running on Node.js
- **Language**: TypeScript with ESM modules
- **Database ORM**: Drizzle ORM with PostgreSQL
- **API Pattern**: RESTful endpoints under `/api/*`
- **Build Process**: esbuild for production bundling with selective dependency bundling

The server handles API routes, serves the static frontend in production, and manages database operations through a storage abstraction layer. Development uses Vite middleware for hot module replacement.

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Tables**:
  - `users` - User authentication
  - `portfolio_holdings` - User stock positions with cost basis tracking
  - `watchlist` - User's watched stocks
  - `market_cache` - Cached market data with expiration
  - `conversations` and `messages` - Chat history for AI assistant

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` directory are used by both frontend and backend
- **Storage Abstraction**: Database operations go through `IStorage` interface in `server/storage.ts`
- **API Caching**: Market data is cached in the database with configurable expiration
- **Streaming Responses**: Chat API supports Server-Sent Events for streaming AI responses

## External Dependencies

### APIs and Services
- **Laser Beam Capital API** (`https://api.laserbeamcapital.com`): Primary API for all market data
  - `/api/markets` - Returns flat array of all markets with category grouping
  - `/api/news/market` - Returns `{ articles: [...] }` with market news
  - `/api/news/portfolio` - Returns `{ articles: [...] }` with portfolio-related news
  - `/api/market-summary` - Returns HTML-formatted market commentary
  - `/api/fundamental-analysis/analyze` - POST endpoint for stock analysis (sync)
  - `/api/fundamental-analysis/jobs` - POST endpoint to start async deep analysis job
  - `/api/fundamental-analysis/jobs/{jobId}` - GET endpoint to poll job status
  - `/api/fundamental-analysis/jobs/{jobId}/result` - GET endpoint to fetch analysis result

### Deep Analysis Feature
The stock analysis page uses an async job workflow for comprehensive fundamental analysis:
- **Mode Detection**: Automatically determines analysis mode (preview/review/deep_dive) based on earnings timing
- **Data Sources**: Company overview, financial statements, metrics, current price, analyst estimates, news, web search
- **AI Analysis**: Uses OpenRouter (Kimi K2.5) for hedge fund quality research output
- **Recommendation**: Generates Buy/Hold/Sell with confidence score, target price, upside/downside, and time horizon
- **Output Sections**: Executive Summary, Financial Snapshot, Forward Outlook, Valuation Analysis, Key Risks & Catalysts, Investment Thesis
- **OpenRouter API**: AI/LLM fallback using Moonshot AI's Kimi K2.5 model (`moonshotai/kimi-k2.5`) for chat functionality and stock analysis when Laser Beam API is unavailable

### Data Transformation
The backend transforms external API data to match frontend expectations:
- `lastPrice` → `price`
- `chgDay` → `change1D`
- `chgMonth` → `change1M`
- `chgQtr` → `change1Q`
- `chgYear` → `change1Y`
- `pxVs10d` → `vs10D`
- `pxVs20d` → `vs20D`
- `pxVs200d` → `vs200D`

### Database
- **PostgreSQL**: Primary database (connection via `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database migrations stored in `./migrations`

### Key Runtime Dependencies
- `drizzle-orm` + `pg`: Database connectivity
- `express`: Web server framework
- `@tanstack/react-query`: Data fetching and caching
- `openai`: OpenRouter API client (OpenAI-compatible)
- Radix UI primitives: Accessible UI components
- `recharts`: Chart visualizations

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `OPENROUTER_API_KEY` or `AI_INTEGRATIONS_OPENROUTER_API_KEY`: API key for AI features