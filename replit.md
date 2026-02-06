# Buy Side Bro

## Overview
Buy Side Bro is a full-stack web application providing a modern financial markets dashboard and portfolio tracker. It offers real-time market data visualization, portfolio management, AI-powered stock analysis, earnings calendars, financial news aggregation, and an AI chat assistant. The platform aims to deliver a comprehensive financial tool, rivaling expensive alternatives, with a focus on intuitive design and AI-driven insights.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui on Radix UI
- **Styling**: Tailwind CSS with CSS variables
- **Build Tool**: Vite
- **Charts**: Recharts
- **Visual Theme**: Neon Green Terminal Aesthetic (black background, neon green accents, Orbitron/JetBrains Mono fonts, subtle glow effects, scanline overlay).

### Backend
- **Framework**: Express.js 5 on Node.js
- **Language**: TypeScript with ESM modules
- **ORM**: Drizzle ORM with PostgreSQL
- **API Pattern**: RESTful endpoints
- **Authentication**: Replit Auth (OpenID Connect) with PostgreSQL-backed sessions.
- **Subscription**: Stripe integration for managing "Buy Side Bro Pro" subscriptions and credit packs.
- **AI Credit System**: Tracks OpenRouter API usage in a `usage_logs` table, enforcing monthly allowances and credit pack purchases.
- **Admin Dashboard**: Accessible to specific users, providing activity logging, user management, and AI usage statistics.
- **News Feed System**: Aggregates and summarizes market news for ASX, USA, and Europe markets at key intervals.
- **Data Storage**: PostgreSQL with Drizzle ORM for `users`, `portfolio_holdings`, `watchlist`, `market_cache`, `conversations`, and `messages`.

### Key Features
- **Markets Page**: Displays global market data, futures, commodities, and sectors with a scrolling ticker tape and sortable data tables.
- **Stock Search**: Global stock search combining multiple API sources, with deduplication.
- **Watchlist**: Allows tracking stocks without cost basis, providing live price and fundamental data.
- **Stock Analysis**: Asynchronous job workflow for deep fundamental analysis, utilizing AI for research output and recommendations (Buy/Hold/Sell).
- **MSFT Cached Analysis**: Database-backed cached MSFT deep analysis served instantly to non-logged-in users. Fetches from Laser Beam Capital API's `/api/cached-analysis/MSFT` endpoint every 24h. Quality validation keeps existing cache if API returns poor results. Stored in `market_cache` table with 24h TTL.
- **AI Chat ("Ask Bro")**: Proxied through Laser Beam Capital API's `/api/chat/bro` SSE endpoint. Buy Side Bro handles credit checks, conversation storage, and usage tracking locally; the AI generation happens on the Laser Beam Capital server.
- **Technical SEO**: Implemented with dynamic `robots.txt` and `sitemap.xml`, structured data, meta tags, per-page titles, and performance optimizations.

### Design Patterns
- **Shared Types**: Schema definitions are shared between frontend and backend.
- **Storage Abstraction**: Database operations via an `IStorage` interface.
- **API Caching**: Market data cached in the database with expiration.
- **Streaming Responses**: Server-Sent Events for AI chat.

## External Dependencies

### APIs and Services
- **Laser Beam Capital API** (`https://laserbeamcapital.replit.app`): Separate always-on Replit project serving as the data engine.
  - `/api/markets` — market data (indices, futures, commodities, sectors)
  - `/api/news/market`, `/api/news/portfolio` — news feeds
  - `/api/market-summary` — market summary
  - `/api/fundamental-analysis/analyze`, `/api/fundamental-analysis/jobs` — deep analysis jobs
  - `/api/chat/bro` — AI chat streaming endpoint (SSE, uses Claude Opus 4)
  - `/api/cached-analysis/MSFT` — pre-cached MSFT deep analysis (refreshed daily on that server)
- **OpenRouter**: Used for AI/LLM functionalities (stock analysis summaries in routes.ts), specifically Moonshot AI's Kimi K2.5 model. Chat is now proxied through Laser Beam Capital.
- **Replit Auth**: For user authentication (Google, Apple, GitHub, X, email/password).
- **Stripe**: For subscription management and credit pack purchases.
- **Yahoo Finance**: Data source for Market Cap and Trailing P/E Ratio (via Laser Beam Capital API).
- **FMP (Financial Modeling Prep)**: Data source for Forward P/E Ratio, stock search (via Laser Beam Capital API).
- **Alpha Vantage**: Data source for earnings calendar (via Laser Beam Capital API).

### Database
- **PostgreSQL**: Main database for persistent storage.

### Key Runtime Dependencies
- `drizzle-orm` + `pg`
- `express`
- `@tanstack/react-query`
- `openai` (for OpenRouter API client)
- Radix UI primitives
- `recharts`