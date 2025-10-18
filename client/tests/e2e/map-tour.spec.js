import { test, expect } from '@playwright/test';

const createMap = ({ id, name, biome, description, soundscape }) => {
  const baseTiles = Array.from({ length: 4 }, () => ['floor', 'floor', 'floor', 'floor']);
  const overlayTiles = [
    [null, 'accent', null, null],
    [null, 'accent', null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];

  return {
    id,
    name,
    biome,
    description,
    size: { width: 4, height: 4 },
    spawn: { x: 1, y: 1 },
    tileTypes: {
      floor: { id: 'floor', name: 'Plataforma QA', collides: false, transparent: false, color: '#8eb5ff' },
      accent: { id: 'accent', name: 'Camino iluminado', collides: false, transparent: true, color: '#c2d9ff' }
    },
    layers: [
      {
        id: 'ground',
        name: 'Ground',
        order: 0,
        visible: true,
        placement: 'ground',
        tiles: baseTiles
      },
      {
        id: 'walkway',
        name: 'Pasarela',
        order: 1,
        visible: true,
        placement: 'overlay',
        tiles: overlayTiles
      }
    ],
    collidableTiles: [],
    objects: [],
    objectLayers: [],
    theme: { soundscape }
  };
};

const MAP_FIXTURES = [
  createMap({
    id: 'map-bridge',
    name: 'Paseo de mando',
    biome: 'Comando',
    description: 'Pasarela central con paneles luminosos.',
    soundscape: 'bridge-hum'
  }),
  createMap({
    id: 'map-garden',
    name: 'Invernadero modular',
    biome: 'Biológico',
    description: 'Cubierta con cultivos escalonados y nebulizadores.',
    soundscape: 'garden-birds'
  }),
  createMap({
    id: 'map-lounge',
    name: 'Sala de relajación',
    biome: 'Habitacional',
    description: 'Zona tranquila con textiles suaves y hologramas.',
    soundscape: 'quarters-soft'
  })
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__COMMUNITY_DISABLE_SOCKET__ = true;
    window.__COMMUNITY_BOOTSTRAP_PROFILE__ = {
      alias: 'QA Bot',
      playerId: 'qa-bot',
      mapId: 'map-bridge'
    };
  });

  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        user: { alias: 'QA Bot', playerId: 'qa-bot', mapId: 'map-bridge' }
      })
    });
  });

  await page.route('**/maps/static', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        maps: MAP_FIXTURES,
        objectDefinitions: [],
        canvasDefinitions: []
      })
    });
  });

  const fulfillEmptyObjects = async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [] })
    });
  };

  await page.route('**/objects', fulfillEmptyObjects);
  await page.route('**/objects?*', fulfillEmptyObjects);
});

test('map tour rotates maps and preserves HUD state', async ({ page }) => {
  await page.goto('/world');
  await page.waitForLoadState('networkidle');

  const topbar = page.getByRole('region', { name: 'Información general del mapa' });
  const canvas = page.locator('canvas.map-viewport__canvas');

  for (let index = 0; index < MAP_FIXTURES.length; index += 1) {
    const current = MAP_FIXTURES[index];

    await expect(topbar.locator('.topbar__title')).toHaveText(current.name);
    await expect(topbar.locator('.topbar__subtitle')).toHaveText(current.description);
    await expect(topbar.getByText(`Bioma: ${current.biome}`)).toBeVisible();
    await expect(canvas).toHaveAttribute('data-soundscape', current.theme.soundscape);
    await expect(canvas).toHaveAttribute('data-layer-count', `${current.layers.length}`);

    if (index < MAP_FIXTURES.length - 1) {
      await page.getByRole('button', { name: 'Mapa siguiente' }).click();
    }
  }

  await page.getByRole('button', { name: 'Mapa siguiente' }).click();
  await expect(topbar.locator('.topbar__title')).toHaveText(MAP_FIXTURES[0].name);
  await expect(canvas).toHaveAttribute('data-soundscape', MAP_FIXTURES[0].theme.soundscape);

  await expect(page.getByText('Conectado como QA Bot')).toBeVisible();

  const chatInput = page.getByPlaceholder('Escribe un mensaje…');
  await expect(chatInput).toBeEnabled();
  await chatInput.fill('Hola a todas!');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(chatInput).toHaveValue('');
});
