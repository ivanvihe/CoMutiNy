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

Descarga los recursos listados en un archivo `assets.txt` (una URL por línea).

Uso:

```bash
./infrastructure/scripts/download-assets.sh [directorio-de-destino]
```

- Si no se especifica el destino, los archivos se guardan en `infrastructure/assets/`.
- Asegúrese de crear un archivo `assets.txt` en la raíz del proyecto con las URLs a descargar antes de ejecutar el script.
