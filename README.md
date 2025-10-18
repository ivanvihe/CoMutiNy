# CoMutiNy

CoMutiNy es una experiencia sandbox colaborativa inspirada en los juegos voxel, enfocada en construir juntos y conversar en tiempo real. El objetivo es ofrecer una estética moderna con iluminación avanzada y materiales PBR, soporte WebGPU y un backend escalable construido sobre Colyseus.

## Puesta en marcha rápida

```bash
docker-compose up --build
```

Servicios incluidos:

- **Frontend** (Vite + React + Babylon.js 7, WebGPU) en [http://localhost:5173](http://localhost:5173)
- **Backend** (Colyseus 0.15 + Express) en [http://localhost:2567](http://localhost:2567)
- **PostgreSQL** (persistencia de chunks y cuentas) en el puerto `5432`
- **Redis** (caché de chunks y sesiones) en el puerto `6379`

Para detener todos los servicios:

```bash
docker-compose down
```

## Acceso al juego

1. Abre `http://localhost:5173` en tu navegador moderno con soporte WebGPU.
2. Ingresa un nombre de usuario y contraseña (placeholder por ahora) para iniciar sesión.
3. Explora el mundo desde el navegador.

## Controles básicos

- **Movimiento**: WASD (la cámara actual permite orbitar con el mouse mientras damos los primeros pasos en el motor).
- **Mirar alrededor**: Mouse.
- **Chat**: Presiona `Enter` para enfocar y envía mensajes.
- **Inventario**: Números del 1 al 7 (selección visual en la barra inferior).
- **Construcción**: Click izquierdo para romper (placeholder) y click derecho para colocar (pendiente de implementar en siguientes iteraciones).

## Arquitectura

```
CoMutiNy/
├── docker-compose.yml
├── frontend/        # Vite + React + Babylon.js (WebGPU)
│   ├── src/
│   │   ├── engine/      # Inicialización del motor y escena principal
│   │   ├── voxel/       # Sistema de chunks, materiales y generación procedural
│   │   ├── multiplayer/ # Cliente Colyseus y estado local
│   │   └── ui/          # HUD, chat y login
├── backend/         # Colyseus + Express + PostgreSQL + Redis
│   ├── src/
│   │   ├── rooms/       # Rooms Colyseus para sincronización multijugador
│   │   ├── world/       # Generación de terreno y persistencia de chunks
│   │   └── database/    # Conexiones a PostgreSQL y Redis
└── README.md
```

## Características implementadas en esta iteración

- 🔧 Repositorio reiniciado con estructura nueva enfocada al stack deseado.
- 🧱 Motor de rendering base con Babylon.js 7 y soporte WebGPU + fallback.
- 🌄 Generación procedural básica de terreno voxel compartida entre frontend y backend.
- ☁️ Iluminación HDR con cielo procedural, sombras dinámicas y materiales PBR.
- 🧩 Integración inicial con Colyseus (room "world"), PostgreSQL y Redis.
- 🧰 Docker Compose listo para levantar todo el stack con un solo comando.

## Roadmap sugerido

1. **Interacción voxel**: Implementar colocación/rotura de bloques sincronizada via Colyseus.
2. **Streaming de chunks**: Carga/descarga dinámica según distancia del jugador.
3. **Cuenta y autenticación**: Hash de contraseñas, sesiones y validación real.
4. **Movimiento en primera persona**: Controles con física, salto y gravedad.
5. **Persistencia avanzada**: Guardado incremental y control de versiones de construcciones.
6. **Efectos visuales**: Agua dinámica, partículas, niebla volumétrica y ciclo día/noche.
7. **UI colaborativa**: Chat de proximidad, listas de amigos y herramientas comunitarias.

## Notas sobre texturas

Para mantener el repositorio libre de binarios se utilizan materiales PBR generados por código y entornos HDR alojados externamente. Esto facilita iterar sin añadir archivos pesados al control de versiones.

Si necesitas texturas de ejemplo para los bloques vóxel, sigue la guía de [docs/texture-assets.md](docs/texture-assets.md), donde se listan enlaces de descarga CC0 y las rutas de destino esperadas por el frontend.
