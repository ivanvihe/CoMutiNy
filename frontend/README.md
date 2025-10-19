# CoMutiNy Frontend

Aplicación frontend inicializada con [Vite](https://vite.dev/) usando React y TypeScript. Incluye la configuración básica de ESLint y Prettier junto con las dependencias necesarias para integrar Phaser, Colyseus y el estado global con Zustand.

## Scripts disponibles

- `npm run dev`: levanta el entorno de desarrollo de Vite.
- `npm run build`: ejecuta la compilación del proyecto y la verificación de tipos.
- `npm run preview`: sirve la compilación generada para revisión.
- `npm run lint`: analiza el código con ESLint.
- `npm run lint:fix`: intenta corregir automáticamente los problemas detectados por ESLint.
- `npm run format`: aplica el formateo definido por Prettier.
- `npm run format:check`: valida que los archivos cumplan con el formato de Prettier.
- `npm run typecheck`: ejecuta la comprobación de tipos sin emitir archivos.

## Dependencias clave

- [`phaser`](https://phaser.io/): motor 2D para la lógica del juego.
- [`@colyseus/client`](https://docs.colyseus.io/colyseus/client/overview/): cliente de Colyseus para la comunicación en tiempo real.
- [`zustand`](https://docs.pmnd.rs/zustand/getting-started/introduction): librería ligera para manejar el estado global en React.
- [`easystarjs`](http://easystarjs.com/): utilidades de pathfinding que complementan la lógica del juego.

## Formateo y linting

- ESLint está configurado en [`eslint.config.js`](./eslint.config.js) con reglas para TypeScript, React y React Hooks, integrándose con Prettier.
- Prettier utiliza la configuración definida en [`.prettierrc.json`](./.prettierrc.json) y excluye los directorios de build y dependencias listados en [`.prettierignore`](./.prettierignore).

## Requisitos previos

Asegúrate de tener instalado [Node.js](https://nodejs.org/) (versión 18 o superior recomendada) y `npm`.

## Instalación

```bash
cd frontend
npm install
```

## Ejecución

```bash
npm run dev
```

Esto abrirá el proyecto en `http://localhost:5173/` por defecto.
