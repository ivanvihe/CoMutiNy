# CoMutiNy

CoMutiNy es un prototipo cooperativo que combina un backend en TypeScript con Colyseus y un frontend isométrico
construido en React + Phaser. Este documento reúne la información necesaria para preparar el entorno, ejecutar
scripts esenciales, descargar assets y documentar las pruebas realizadas.

## Estructura del proyecto

- `backend/`: servicio de juego en Node.js + Colyseus con persistencia en PostgreSQL y TypeORM.
- `frontend/`: cliente web en Vite/React que consume el backend en tiempo real.
- `infrastructure/`: scripts compartidos y definición de assets externos.
- `docker-compose.yml`: orquesta los servicios principales para desarrollo local.

## Requisitos previos

- [Node.js 20](https://nodejs.org/) y `npm`.
- [Docker](https://www.docker.com/) y Docker Compose para levantar el stack completo.
- Acceso a Internet para descargar dependencias y assets externos.

## Configuración local paso a paso

1. Clonar el repositorio y situarse en la raíz del proyecto.
2. Instalar dependencias de cada paquete:

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. Verificar/descargar assets del frontend antes de iniciar cualquier servidor:

   ```bash
   ./infrastructure/scripts/download-assets.sh
   # o bien, desde frontend/
   npm run assets:check
   ```

4. Preparar variables de entorno (ejemplo `.env` para backend):

   ```bash
   cp backend/.env.example backend/.env
   # Editar DATABASE_URL, SESSION_SECRET, etc.
   ```

5. (Opcional) Ejecutar migraciones de TypeORM:

   ```bash
   cd backend
   npm run migration:run
   ```

## Scripts esenciales

| Directorio | Comando | Descripción |
|------------|---------|-------------|
| `backend/` | `npm run dev` | Levanta el servidor Colyseus en modo desarrollo. |
|            | `npm run lint` | Ejecuta ESLint sobre `src/`. |
|            | `npm test` | Lanza las pruebas unitarias con Jest. |
| `frontend/` | `npm run dev` | Arranca Vite en `http://localhost:5173/`. |
|             | `npm run lint` | Analiza el código con ESLint. |
|             | `npm run test` | Ejecuta la suite de Vitest en modo no interactivo. |

Las pruebas unitarias del backend utilizan **Jest** y se centran en servicios críticos como autenticación, chat y
parcelas de construcción. En el frontend se añadió **Vitest** para cubrir utilidades de proyección isométrica y
lógica auxiliar del juego.

## Docker Compose

El archivo [`docker-compose.yml`](docker-compose.yml) define tres servicios:

- **postgres**: PostgreSQL 15 con volúmenes persistentes y credenciales configurables.
- **backend**: servidor Node.js expuesto en `localhost:2567` que lee `DATABASE_URL` de su entorno.
- **frontend**: cliente Vite servido en `localhost:5173` y enlazado al backend mediante `API_URL`.

Comandos habituales:

```bash
docker compose up --build        # Levanta los servicios con reconstrucción
docker compose down              # Detiene y limpia contenedores
docker compose logs -f backend   # Sigue los logs del backend
```

## Assets del proyecto

El frontend requiere recursos externos que no se versionan. El manifiesto
[`infrastructure/assets/manifest.json`](infrastructure/assets/manifest.json) detalla cada archivo y el script
[`download-assets.sh`](infrastructure/scripts/download-assets.sh) automatiza la descarga.

```bash
./infrastructure/scripts/download-assets.sh
```

- Descarga y extrae packs como **Kenney Starter Kit City Builder** dentro de `frontend/public/assets/`.
- Usa `--force` para re-descargar o `--dest`/`--manifest` para rutas alternativas.
- Antes de ejecutar `npm run dev` en el frontend se valida automáticamente que todos los assets existen.

Descarga manual alternativa:

1. Obtener **Kenney Starter Kit City Builder** y copiar los archivos `colormap.png`, `selector.png` y `coin.png`
   a `frontend/public/assets/tilesets/` con los nombres `kenney-citybuilder-colormap.png`,
   `kenney-citybuilder-selector.png` y `kenney-citybuilder-coin.png`.
2. Descargar `brawler48x48.png` del repositorio [photonstorm/phaser3-examples](https://github.com/photonstorm/phaser3-examples)
   y guardarlo como `frontend/public/assets/sprites/brawler48x48.png`.

## Controles básicos del juego

- **Movimiento**: flechas del teclado (desplazamiento inmediato) o clic derecho para mover hacia un punto.
- **Cámara**: mantener pulsado el botón central del ratón para arrastrar; rueda del ratón para acercar/alejar.
- **Construcción**: seleccionar un plano en la interfaz, colocar con clic izquierdo y cancelar con `Esc`.
- **Chat**: abrir el panel lateral, escribir el mensaje y confirmar con `Enter`.

## Pruebas manuales

| Escenario | Resultado | Notas |
|-----------|-----------|-------|
| Movimiento del avatar | ⚠️ No ejecutado | Requiere entorno gráfico; seguir pasos de configuración local. |
| Construcción sobre parcela propia | ⚠️ No ejecutado | Validar con cuenta propietaria y assets disponibles. |
| Envío/recepción de chat global | ⚠️ No ejecutado | Necesita dos clientes conectados simultáneamente. |
| Reconexión tras cierre del cliente | ⚠️ No ejecutado | Probar cerrando la pestaña y reabriendo en < 30 s. |

> Actualiza la tabla con la fecha y observaciones cuando ejecutes las pruebas en un entorno con interfaz gráfica.

## Licencias

- **Código del backend**: licencia ISC (ver `backend/package.json`).
- **Código del frontend**: sin licencia definida; añade una licencia apropiada antes de publicar.
- **Assets**:
  - *Kenney Starter Kit City Builder*: licencia MIT (incluida en el paquete).
  - *Phaser Brawler Sprite Sheet*: licencia MIT disponible en el repositorio de ejemplos.

## Autenticación y creación del primer usuario

El backend expone endpoints HTTP en `/api/auth` para registro e inicio de sesión con contraseñas protegidas mediante
`bcrypt` y sesiones en memoria.

- **Registrar usuario**: `POST /api/auth/register`
- **Iniciar sesión**: `POST /api/auth/login`

Ejemplo de creación del primer usuario:

```bash
curl -X POST "http://localhost:2567/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "c0mut1ny!",
    "displayName": "Admin"
  }'
```

El token devuelto se guarda en el frontend (por ejemplo, en `localStorage`) para autenticar las siguientes peticiones.
