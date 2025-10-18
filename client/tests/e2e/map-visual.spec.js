import { test, expect } from '@playwright/test';

const visualTestMap = {
  id: 'qa-visual',
  name: 'Escena QA',
  biome: 'Simulación',
  description: 'Mapa sintético para validar capas y alturas.',
  size: { width: 4, height: 4 },
  spawn: { x: 1, y: 1 },
  tileTypes: {
    floor: { id: 'floor', name: 'Plataforma base', collides: false, transparent: false, color: '#8eb5ff' },
    walkway: { id: 'walkway', name: 'Pasarela', collides: false, transparent: true, color: '#c2d9ff' },
    canopy: { id: 'canopy', name: 'Copa', collides: false, transparent: true, color: '#2f6b3f' }
  },
  layers: [
    {
      id: 'ground',
      name: 'Ground',
      order: 0,
      visible: true,
      placement: 'ground',
      elevation: 0,
      tiles: [
        ['floor', 'floor', 'floor', 'floor'],
        ['floor', 'floor', 'floor', 'floor'],
        ['floor', 'floor', 'floor', 'floor'],
        ['floor', 'floor', 'floor', 'floor']
      ]
    },
    {
      id: 'walkway',
      name: 'Pasarela',
      order: 1,
      visible: true,
      placement: 'ground',
      elevation: 0.2,
      opacity: 0.95,
      tiles: [
        [null, 'walkway', 'walkway', null],
        [null, 'walkway', 'walkway', null],
        [null, null, null, null],
        [null, null, null, null]
      ]
    },
    {
      id: 'canopy',
      name: 'Canopy',
      order: 2,
      visible: true,
      placement: 'overlay',
      elevation: 0.8,
      opacity: 0.9,
      tiles: [
        [null, null, 'canopy', null],
        [null, null, 'canopy', null],
        [null, null, null, null],
        [null, null, null, null]
      ]
    }
  ],
  collidableTiles: [
    { x: 1, y: 1 },
    { x: 2, y: 1 }
  ],
  objects: [
    {
      id: 'elevated_platform-qa',
      name: 'Plataforma QA',
      solid: true,
      position: { x: 1, y: 1 },
      size: { width: 1, height: 1 },
      objectId: 'elevated_platform',
      metadata: { objectId: 'elevated_platform' },
      appearance: {
        generator: 'tieredPlatform',
        width: 1,
        height: 1,
        tileSize: 32,
        anchor: { x: 0.5, y: 1, z: 0 },
        offset: { x: 0, y: -0.05, z: 0 },
        scale: { x: 1, y: 1 }
      },
      volume: { height: 1.6, anchor: { x: 0.5, y: 1, z: 0 } }
    },
    {
      id: 'observation_tower-qa',
      name: 'Torre QA',
      solid: true,
      position: { x: 2, y: 1 },
      size: { width: 1, height: 1 },
      objectId: 'observation_tower',
      metadata: { objectId: 'observation_tower' },
      appearance: {
        generator: 'observationTower',
        width: 1,
        height: 3,
        tileSize: 32,
        anchor: { x: 0.5, y: 1, z: 0 },
        offset: { x: 0, y: -0.1, z: 0 },
        scale: { x: 1, y: 1 }
      },
      volume: { height: 3.4, anchor: { x: 0.5, y: 1, z: 0 } }
    }
  ],
  objectLayers: []
};

const prototypeDefinitions = [
  {
    id: 'elevated_platform',
    name: 'Plataforma elevada modular',
    description: 'Segmento de pasarela con soportes visibles.',
    appearance: visualTestMap.objects[0].appearance,
    volume: visualTestMap.objects[0].volume,
    metadata: { tags: ['prototype', 'platform'] }
  },
  {
    id: 'observation_tower',
    name: 'Torre modular de observación',
    description: 'Estructura alta con barandales y focos.',
    appearance: visualTestMap.objects[1].appearance,
    volume: visualTestMap.objects[1].volume,
    metadata: { tags: ['prototype', 'tower'] }
  }
];

test.beforeEach(async ({ page }) => {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.error('[browser]', message.text());
    }
  });

  await page.addInitScript(() => {
    window.__COMMUNITY_DISABLE_SOCKET__ = true;
    window.__COMMUNITY_BOOTSTRAP_PROFILE__ = {
      alias: 'QA Bot',
      playerId: 'qa-bot',
      mapId: 'qa-visual'
    };
  });

  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        user: { alias: 'QA Bot', playerId: 'qa-bot', mapId: 'qa-visual' }
      })
    });
  });

  await page.route('**/@fs/**/server/maps/*.map?*', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/javascript' },
      body: 'export default "";'
    });
  });

  await page.route('**/maps/static', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        maps: [visualTestMap],
        objectDefinitions: prototypeDefinitions,
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

test('canvas expone métricas de capas y alturas', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(750);

  await page.goto('/world');
  await expect(page).toHaveURL(/\/world$/);

  const canvas = page.locator('canvas.map-viewport__canvas');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-layer-count', '3');
  await expect(canvas).toHaveAttribute('data-overlay-count', '1');
  await expect(canvas).toHaveAttribute('data-solid-count', '2');

  await expect.poll(async () => {
    const attribute = await canvas.getAttribute('data-max-volume-height');
    return attribute ? Number.parseFloat(attribute) : 0;
  }).toBeGreaterThan(3);
});
