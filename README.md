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

Use Docker Compose to start the full stack (frontend, API and PostgreSQL). The frontend is exposed on port `8123` by default, the API on `4000` and PostgreSQL on `5432`.

```bash
docker compose up --build
```

You can customise the exposed frontend port by setting the `FRONTEND_PORT` environment variable before running the command (for example `FRONTEND_PORT=8812 docker compose up --build`).

Once the containers are running on a remote host you can reach the application from another machine via the server's public IP:

* Frontend: `http://<public-ip>:8123` (or the value of `FRONTEND_PORT` if overridden).
* API: `http://<public-ip>:4000`.

Environment defaults are defined in the root `.env` file and in `server/.env`.
