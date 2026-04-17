# BizScout HTTP Monitor

Simple full-stack monitor for `httpbin.org/anything`.

- Backend: Express + TypeScript + MongoDB + Socket.IO
- Frontend: React + Vite
- Features: scheduled pings, live dashboard, anomaly detection, API-key protected API

## Live URLs

- Frontend: [https://bizscout-1.onrender.com/](https://bizscout-1.onrender.com/)
- Backend: [https://bizscout-xh0x.onrender.com](https://bizscout-xh0x.onrender.com)

## Local Setup

### Prerequisites

- Node.js `20+`
- npm `10+`
- MongoDB connection string
- Docker optional

### 1. Install

```bash
git clone https://github.com/muzammalmurtaza365/bizscout.git
cd bizscout-assessment

cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Create env files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3. Required env values

Backend `backend/.env`

```env
PORT=4000
NODE_ENV=development
MONGO_URI=<your-mongo-connection-string>
PING_TARGET_URL=https://httpbin.org/anything
PING_INTERVAL_CRON=*/5 * * * *
PING_TIMEOUT_MS=10000
CORS_ORIGIN=http://localhost:5173
API_KEY=<your-api-key>
```

Frontend `frontend/.env`

```env
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
VITE_API_KEY=<same-api-key-as-backend>
```

Generate an API key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run locally

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Local URLs:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://localhost:4000](http://localhost:4000)

### 5. Optional Docker

To run everything with Docker:

```bash
docker compose up --build
```

Stop:

```bash
docker compose down
```

## Deployment Setup

### Backend

- Root directory: `backend`
- Build command: `npm ci && npm run build`
- Start command: `node dist/index.js`
- Health check path: `/health`

Required backend env vars:

- `NODE_ENV=production`
- `PORT=10000`
- `MONGO_URI`
- `CORS_ORIGIN`
- `API_KEY`

### Frontend

- Root directory: `frontend`
- Build command: `npm run build`

Required frontend env vars:

- `VITE_API_URL=https://bizscout-xh0x.onrender.com`
- `VITE_SOCKET_URL=https://bizscout-xh0x.onrender.com`
- `VITE_API_KEY=<same-api-key-as-backend>`

## Quick Checks

```bash
curl https://bizscout-xh0x.onrender.com/health
curl -H "X-API-KEY: <your-api-key>" "https://bizscout-xh0x.onrender.com/api/responses?limit=5"
```
