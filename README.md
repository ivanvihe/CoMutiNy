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

### Flujo de alias y perfil compartido

Al iniciar la aplicación se muestra el componente `AliasEntry`, que guía al usuario para escoger un alias antes de incorporarse al mundo colaborativo. El cliente envía el alias mediante `joinWorld()` dentro del `WorldContext`, y el backend (`WorldState.addPlayer`) rechaza la sesión si no recibe uno válido. El alias saneado se almacena en la metadata de la persona participante, alimenta el listado de presencia y se replica al resto de clientes a través de `player:joined`/`player:updated`. Puedes actualizarlo en cualquier momento desde el mismo formulario; el servidor propagará los cambios y reasignará el nombre visible en caliente.

Cuando alguien vuelve a conectar con el mismo navegador, el contexto reutiliza la última sesión y precarga el alias configurado previamente. Ante desconexiones forzadas el servidor emite `session:terminated`, el cliente muestra el motivo y solicita un alias de nuevo para evitar colisiones de identidad.

### Mapas, motor y requisitos de arte

El frontend utiliza un motor isométrico ligero (`client/src/game/isometricEngine.js`) que renderiza los mapas definidos en `client/src/game/maps.js`, cargados dinámicamente desde archivos de texto ubicados en `./maps/`, y en el resumen JSON de `config/maps.json`. Cada mapa describe el entorno, el tamaño en tiles, zonas bloqueadas, objetos interactivos y portales con destino a otros mapas. El documento [docs/graphics-engine.md](docs/graphics-engine.md) detalla la estructura completa, así como la relación entre `MapContext`, `MapViewport` y el estado en tiempo real.

El motor espera tiles romboidales de `64×32 px` y sprites con frames de `48×64 px`, cuatro direcciones (`down`, `left`, `right`, `up`) y una animación base `idle/walk`. Estos valores pueden ajustarse al inicializar el motor, pero los assets personalizados deben respetar las proporciones para evitar deformaciones. Consulta la sección de "Requisitos de tilesets y sprites" en la guía del motor para conocer la distribución de capas, el orden de dibujo y cómo aportar tilesets o atlas nuevos.

### Generación automática de sprites

El pipeline para generar sprites a partir de descripciones de texto, junto con el proceso para ejecutarlo desde scripts internos, está documentado en [docs/sprite-generation.md](docs/sprite-generation.md). La guía también cubre cómo producir sprites animados y registrar el atlas resultante en el runtime.
