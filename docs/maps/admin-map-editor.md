# Editor administrativo de mapas

Este módulo introduce un flujo completo para crear y mantener mapas isométricos desde la aplicación web y persistirlos en la base de datos.

## Requisitos de acceso

- Únicamente las sesiones con un alias que contenga la cadena `admin` pueden acceder a la vista `/admin/maps`.
- El guardián de rutas vive en `client/src/App.jsx` y redirige al formulario de ingreso cuando el perfil no cumple las condiciones.

## Vista de edición (`client/src/components/Admin/MapEditor.jsx`)

- Presenta una lista de mapas existentes y un formulario con campos para nombre, slug, dimensiones, spawn, paleta y metadata.
- Permite definir zonas bloqueadas dinámicas y gestionar objetos interactivos.
- Cada objeto expone campos para posición, tamaño, colisión y una lista dinámica de acciones con payloads serializables.
- Todas las peticiones consumen el servicio HTTP centralizado en `client/src/api/maps.js`.

## API REST (`server/src/routes/mapRoutes.js`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/maps` | Lista paginada de mapas con sus objetos. |
| `POST` | `/maps` | Crea un nuevo mapa y sus objetos asociados. |
| `GET` | `/maps/:mapId` | Obtiene un mapa específico. |
| `PUT` | `/maps/:mapId` | Actualiza metadatos del mapa. |
| `DELETE` | `/maps/:mapId` | Elimina el mapa y sus objetos. |
| `POST` | `/maps/:mapId/objects` | Crea un objeto vinculado a un mapa. |
| `PUT` | `/maps/:mapId/objects/:objectId` | Actualiza un objeto específico. |
| `DELETE` | `/maps/:mapId/objects/:objectId` | Elimina un objeto. |

## Validación y serialización (`server/src/services/mapService.js`)

- Normaliza dimensiones, spawn y paletas para mantener compatibilidad con `client/src/game/maps.js`.
- Las acciones de objeto reciben un identificador estable y aceptan payloads en JSON o texto plano.
- El servicio controla la traducción bidireccional entre las entidades de Sequelize y la estructura que espera el motor del cliente.

## Persistencia

- Nuevas migraciones crean las tablas `maps` y `map_objects` con relaciones en cascada.
- El seeder `20241004130500-seed-maps.js` inicializa un mapa de ejemplo alineado con el mapa `comunidad-inicial` existente en el cliente.

## Flujo recomendado

1. Acceder a `/admin/maps` con una sesión administrativa.
2. Crear o seleccionar un mapa existente para editar sus propiedades básicas.
3. Guardar el mapa y, posteriormente, añadir o modificar objetos y acciones.
4. Confirmar cambios ejecutando `npm run migrate && npm run seed` en el servidor cuando se despliegue en un entorno limpio.
