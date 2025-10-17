# CoMutiNy

## Backend server

The `server/` directory contains a minimal Express application with Socket.IO and a PostgreSQL connection managed through Sequelize.

### Local development

```bash
cd server
cp .env.example .env # if you need to customise the environment
npm install
npm run dev
```

The API is exposed on `http://localhost:4000` and exposes a `GET /health` endpoint for health checks. Socket.IO connections use the same port.

### Docker

Use Docker Compose to start both the API and a PostgreSQL instance:

```bash
docker compose up --build
```

Environment defaults are defined in the root `.env` file and in `server/.env`.
