import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const sourceDirectory = path.resolve('node_modules/maplibre-gl/dist');
const targetDirectory = path.resolve('dist/assets');
const workerFiles = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

await mkdir(targetDirectory, { recursive: true });
await Promise.all(workerFiles.map((file) => (
  copyFile(path.join(sourceDirectory, file), path.join(targetDirectory, file))
)));
