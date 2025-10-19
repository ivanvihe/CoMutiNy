# Estructura del proyecto

Este repositorio se organiza en tres módulos principales:

- `backend/`: código y configuración del servicio de backend.
- `frontend/`: aplicaciones y recursos de la interfaz de usuario.
- `infrastructure/`: infraestructura compartida, scripts y herramientas de despliegue.

## Servicios en contenedores

El archivo [`docker-compose.yml`](docker-compose.yml) define los servicios básicos necesarios para un entorno de desarrollo local:

- **postgres**: base de datos relacional PostgreSQL 15 con volúmenes persistentes.
- **backend**: servicio de aplicación que se conecta a la base de datos mediante la variable `DATABASE_URL`.
- **frontend**: aplicación cliente con la variable `API_URL` apuntando al backend.

Todos los servicios comparten la red por defecto de Docker Compose y exponen los puertos habituales (`5432`, `8000`, `3000`).

Para iniciar el entorno:

```bash
docker compose up --build
```

## Scripts

Los scripts compartidos residen en `infrastructure/scripts/`.

## Autenticación y creación del primer usuario

El backend expone endpoints HTTP para manejar el registro e inicio de sesión. Las rutas están disponibles en
`/api/auth` y utilizan contraseñas protegidas con `bcrypt` junto con un sistema sencillo de sesiones en memoria.

- **Registrar usuario**: `POST /api/auth/register`
- **Iniciar sesión**: `POST /api/auth/login`

Ambos endpoints devuelven un JSON con el token de sesión (`token`), la fecha de expiración y los datos del
usuario autenticado. El cliente web guarda esta información en `localStorage` y envía automáticamente el token en
la cabecera `Authorization` en las peticiones subsecuentes.

### Crear el primer usuario

Tras desplegar o levantar el proyecto por primera vez, crea la cuenta inicial ejecutando una petición `register`.
El siguiente ejemplo con `curl` muestra los campos requeridos:

```bash
curl -X POST "http://localhost:2567/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "c0mut1ny!",
    "displayName": "Admin"
  }'
```

El token devuelto puede usarse inmediatamente para iniciar sesión desde el frontend o para realizar llamadas
autenticadas al backend.

### `download-assets.sh`

### Assets del proyecto

El frontend requiere un pequeño conjunto de recursos externos que no se versionan en Git. El manifiesto
[`infrastructure/assets/manifest.json`](infrastructure/assets/manifest.json) describe cada descarga y el script
`download-assets.sh` automatiza el proceso.

```bash
./infrastructure/scripts/download-assets.sh
```

- Descarga y extrae packs comprimidos (por ejemplo, **Kenney Starter Kit City Builder**) y los coloca en `frontend/public/assets/`.
- Usa `--force` para re-descargar y sobrescribir archivos existentes o `--dest`/`--manifest` para rutas alternativas.
- Antes de arrancar el frontend se ejecuta automáticamente `npm run assets:check`, que llama a
  [`check-assets.sh`](infrastructure/scripts/check-assets.sh) para validar que todos los archivos definidos en el manifiesto existen.

Si prefieres obtener los recursos de forma manual:

1. Descarga el paquete **Kenney Starter Kit City Builder** desde [kenney.nl](https://kenney.nl/assets/starter-kit-city-builder)
   (o su repositorio en GitHub) y copia los archivos `models/Textures/colormap.png` y `sprites/{selector.png,coin.png}` a
   `frontend/public/assets/tilesets/` con los nombres `kenney-citybuilder-colormap.png`, `kenney-citybuilder-selector.png`
   y `kenney-citybuilder-coin.png` respectivamente.
2. Descarga el sprite sheet `brawler48x48.png` del repositorio de [photonstorm/phaser3-examples](https://github.com/photonstorm/phaser3-examples)
   y guárdalo como `frontend/public/assets/sprites/brawler48x48.png`.

#### Licencias de los assets

- **Kenney Starter Kit City Builder**: publicado bajo licencia MIT (ver `LICENSE.md` dentro del paquete).
- **Phaser Brawler Sprite Sheet**: licencia MIT disponible en el repositorio de Phaser 3 Examples.

Mantén los archivos descargados fuera de control de versiones (ya ignorados en `.gitignore`) y conserva los archivos de licencia
adjuntos si distribuyes los assets junto a tu build.
