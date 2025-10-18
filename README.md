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

### `download-assets.sh`

Descarga los recursos listados en un archivo `assets.txt` (una URL por línea).

Uso:

```bash
./infrastructure/scripts/download-assets.sh [directorio-de-destino]
```

- Si no se especifica el destino, los archivos se guardan en `infrastructure/assets/`.
- Asegúrese de crear un archivo `assets.txt` en la raíz del proyecto con las URLs a descargar antes de ejecutar el script.
