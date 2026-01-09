# SM-Visitor - Visitor Management System

A minimal MyGate-style visitor management system with separate interfaces for guards and homeowners.

## Project Structure

This is a monorepo containing:

- **Orbit** (`apps/orbit/`) - Guard/Staff interface (Next.js on port 3000)
- **Horizon** (`apps/horizon/`) - Owner/Approver interface (Next.js on port 3001)
- **Pantry** (`apps/pantry/`) - Backend API (FastAPI on port 8000)
- **Shared Packages** (`packages/`) - Shared UI components, types, and utilities

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Python 3.11+
- MongoDB running on localhost:27017

### Installation

```bash
# Install all dependencies
pnpm install

# Install Python dependencies for Pantry
cd apps/pantry
pip install -r requirements.txt
```

### Development

**Start all apps in parallel:**

```bash
pnpm dev
```

**Or start individually:**

```bash
# Guard app (Orbit)
pnpm dev:orbit

# Owner app (Horizon)
pnpm dev:horizon

# Backend API (Pantry)
pnpm dev:pantry
```

### Access the Apps

- **Orbit (Guard)**: http://localhost:3000
- **Horizon (Owner)**: http://localhost:3001
- **Pantry API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Features

### Guard Interface (Orbit)

- QR code scanning for regular visitors
- New visitor registration with photo capture
- Real-time approval notifications
- Visit history and logs

### Owner Interface (Horizon)

- Approve/deny new visitor requests
- Manage regular visitors
- Generate temporary QR codes for guests
- View visit history

### Backend (Pantry)

- OTP-based authentication
- JWT token management
- QR code generation and validation
- Photo storage
- Real-time notifications via SSE

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS, TypeScript
- **Backend**: FastAPI, Motor (async MongoDB), PyJWT
- **Database**: MongoDB
- **Monorepo**: pnpm workspaces + Turborepo

## Development Scripts

```bash
pnpm dev          # Start all apps in parallel
pnpm build        # Build all apps
pnpm lint         # Lint all apps
pnpm type-check   # Type-check TypeScript apps
pnpm format       # Format code with Prettier
```

## Environment Variables

### Pantry (Backend)

Copy `apps/pantry/.env.example` to `apps/pantry/.env` and configure:

- MongoDB connection string
- JWT secret
- Storage settings

### Orbit & Horizon (Frontend)

Create `.env.local` files with:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## License

ISC
