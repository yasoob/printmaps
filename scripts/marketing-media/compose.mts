import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const FONT = process.env.MEDIA_FONT ?? '/System/Library/Fonts/Helvetica.ttc';
export const BACKDROP = '#ebe8e1';

export async function magick(args: string[]) {
  await run('magick', args, { maxBuffer: 64 * 1024 * 1024 });
}

export async function dimensions(file: string): Promise<{ width: number; height: number }> {
  const { stdout } = await run('magick', ['identify', '-format', '%w %h', `${file}[0]`]);
  const [width, height] = stdout.trim().split(' ').map(Number);
  return { width, height };
}

export type Crop = { x: number; y: number; width: number; height: number };

type EncodeOptions = { width?: number; height?: number; crop?: Crop; quality?: number; format?: 'webp' | 'png' | 'jpg' | 'avif' };

/** Crop (in source pixels), resize to fit exactly `width`×`height` (cover) and encode. */
export async function encode(input: string, output: string, options: EncodeOptions = {}) {
  await mkdir(path.dirname(output), { recursive: true });
  const args = [input];
  if (options.crop) args.push('-crop', `${options.crop.width}x${options.crop.height}+${options.crop.x}+${options.crop.y}`, '+repage');
  if (options.width && options.height) {
    args.push('-filter', 'Lanczos', '-resize', `${options.width}x${options.height}^`, '-gravity', 'center', '-extent', `${options.width}x${options.height}`);
  } else if (options.width) {
    args.push('-filter', 'Lanczos', '-resize', `${options.width}x`);
  }
  const format = options.format ?? (path.extname(output).slice(1) as EncodeOptions['format']);
  args.push('-strip');
  if (format === 'webp') args.push('-quality', String(options.quality ?? 86), '-define', 'webp:method=6', '-define', 'webp:use-sharp-yuv=true');
  if (format === 'jpg') args.push('-quality', String(options.quality ?? 88), '-sampling-factor', '4:2:0');
  if (format === 'png') args.push('-define', 'png:compression-level=9');
  if (format === 'avif') args.push('-quality', String(options.quality ?? 62));
  args.push(output);
  await magick(args);
}

/** The one presentation used for every finished poster: the export on a warm neutral backdrop with a soft shadow. */
export async function presentPoster(input: string, output: string, canvas = { width: 1600, height: 1200 }) {
  const { width, height } = await dimensions(input);
  const isPortrait = height >= width;
  const target = isPortrait
    ? `x${Math.round(canvas.height * 0.86)}`
    : `${Math.round(canvas.width * 0.84)}x${Math.round(canvas.height * 0.86)}`;
  const temporary = `${output}.compose.png`;
  await mkdir(path.dirname(output), { recursive: true });
  await magick([
    '(', input, '-filter', 'Lanczos', '-resize', target, '-bordercolor', '#d9d5cc', '-border', '1', ')',
    '(', '+clone', '-background', '#2b2418', '-shadow', '26x22+0+18', ')', '+swap',
    '-background', 'none', '-layers', 'merge', '+repage',
    '-background', BACKDROP, '-gravity', 'center', '-extent', `${canvas.width}x${canvas.height}`,
    temporary,
  ]);
  await encode(temporary, output, { quality: 88 });
  await run('rm', ['-f', temporary]);
}

/** Lay out several posters side by side on the shared backdrop. */
export async function presentPosterRow(inputs: string[], output: string, canvas = { width: 1600, height: 1000 }) {
  const gap = 56;
  const sizes = await Promise.all(inputs.map((input) => dimensions(input)));
  const totalAspect = sizes.reduce((sum, size) => sum + size.width / size.height, 0);
  const posterHeight = Math.round(Math.min(canvas.height * 0.8, (canvas.width * 0.9 - gap * (inputs.length - 1)) / totalAspect));
  const temporary = `${output}.row.png`;
  await mkdir(path.dirname(output), { recursive: true });
  const tiles: string[] = [];
  for (const input of inputs) {
    tiles.push('(', input, '-filter', 'Lanczos', '-resize', `x${posterHeight}`, '-bordercolor', '#d9d5cc', '-border', '1',
      '(', '+clone', '-background', '#2b2418', '-shadow', '24x18+0+14', ')', '+swap', '-background', 'none', '-layers', 'merge', '+repage', ')');
  }
  await magick([
    ...tiles, '-background', 'none', '-splice', `${gap}x0`, '+append', '-chop', `${gap}x0`, '+repage',
    '-background', BACKDROP, '-gravity', 'center', '-extent', `${canvas.width}x${canvas.height}`, temporary,
  ]);
  await encode(temporary, output, { quality: 88 });
  await run('rm', ['-f', temporary]);
}

export type GridTile = { file: string; label: string };

/** A labelled grid (used for the style overview). */
export async function labelledGrid(tiles: GridTile[], output: string, layout: { columns: number; tileWidth: number; tileHeight: number }) {
  const temporary = `${output}.grid.png`;
  await mkdir(path.dirname(output), { recursive: true });
  const cells: string[][] = [];
  for (const tile of tiles) {
    cells.push(['(', tile.file, '-resize', `${layout.tileWidth}x${layout.tileHeight}^`, '-gravity', 'center', '-extent', `${layout.tileWidth}x${layout.tileHeight}`,
      '-bordercolor', '#d9d5cc', '-border', '1',
      '-background', BACKDROP, '-gravity', 'south', '-splice', '0x46',
      '-font', FONT, '-pointsize', '22', '-fill', '#2a2a2a', '-annotate', '+0+10', tile.label, ')']);
  }
  const rows: string[] = [];
  for (let index = 0; index < tiles.length; index += layout.columns) {
    rows.push('(', ...cells.slice(index, index + layout.columns).flat(), '-background', BACKDROP, '-splice', '28x0', '+append', '-chop', '28x0', ')');
  }
  await magick([
    ...rows, '-background', BACKDROP, '-splice', '0x24', '-append', '-chop', '0x24',
    '-bordercolor', BACKDROP, '-border', '48', temporary,
  ]);
  await encode(temporary, output, { quality: 88 });
  await run('rm', ['-f', temporary]);
}
