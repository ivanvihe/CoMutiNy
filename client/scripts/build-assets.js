#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(projectRoot, 'assets');
const publicDir = path.join(projectRoot, 'public');
const manifestPath = path.join(publicDir, 'assets-manifest.json');

const pipelineDirectories = [
  {
    label: 'objects',
    source: path.join(assetsDir, 'objects'),
    destination: path.join(publicDir, 'objects')
  },
  {
    label: 'tilesets',
    source: path.join(assetsDir, 'tilesets'),
    destination: path.join(publicDir, 'tilesets')
  },
  {
    label: 'phase3 objects',
    source: path.join(assetsDir, 'phase3', 'objects'),
    destination: path.join(publicDir, 'phase3', 'objects')
  },
  {
    label: 'phase3 tilesets',
    source: path.join(assetsDir, 'phase3', 'tilesets'),
    destination: path.join(publicDir, 'phase3', 'tilesets')
  },
  {
    label: 'phase3 sprites',
    source: path.join(assetsDir, 'phase3', 'sprites'),
    destination: path.join(publicDir, 'phase3', 'sprites')
  }
];

const ensureDirectory = async (directory) => {
  await fs.mkdir(directory, { recursive: true });
};

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    return false;
  }
};

const copyFile = async (source, destination) => {
  await ensureDirectory(path.dirname(destination));
  await fs.copyFile(source, destination);
};

const copyDirectory = async (source, destination) => {
  await ensureDirectory(destination);
  const entries = await fs.readdir(source, { withFileTypes: true });

  let copiedFiles = 0;
  // Iteramos secuencialmente para mantener un conteo determinista y evitar
  // condiciones de carrera cuando se copian subdirectorios anidados.
  for (const entry of entries) {
    const entrySource = path.join(source, entry.name);
    const entryDestination = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copiedFiles += await copyDirectory(entrySource, entryDestination);
      continue;
    }

    await copyFile(entrySource, entryDestination);
    copiedFiles += 1;
  }

  return copiedFiles;
};

const buildPipeline = async () => {
  const manifestEntries = [];

  for (const directory of pipelineDirectories) {
    const { label, source, destination } = directory;

    if (!(await pathExists(source))) {
      continue;
    }

    const copiedFiles = await copyDirectory(source, destination);

    manifestEntries.push({
      label,
      source: path.relative(projectRoot, source),
      destination: path.relative(projectRoot, destination),
      files: copiedFiles
    });
  }

  await ensureDirectory(path.dirname(manifestPath));
  const manifest = {
    generatedAt: new Date().toISOString(),
    entries: manifestEntries
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
};

buildPipeline().catch((error) => {
  console.error('[build-assets] Error al procesar assets:', error);
  process.exitCode = 1;
});
