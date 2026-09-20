import type { VideoOptions, VideoPlan } from './types';

const ASPECTS = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 };

function validateVideoOptions(
  options: VideoOptions,
  page: Readonly<{ widthMm: number; heightMm: number }>,
): void {
  if (![5, 10, 15].includes(options.durationSeconds) || ![30, 60].includes(options.fps)) {
    throw new Error('Video duration must be 5, 10, or 15 seconds and target frame rate must be 30 or 60 fps.');
  }
  if (!['orbit', 'sway'].includes(options.motion) || !['standard', 'high'].includes(options.quality)) {
    throw new Error('Choose a supported video motion and quality.');
  }
  if ([page.widthMm, page.heightMm].some((size) => !(Number.isFinite(size) && size > 0))) {
    throw new Error('Video export requires finite positive page dimensions.');
  }
}

export function planVideoExport(
  options: VideoOptions,
  page: Readonly<{ widthMm: number; heightMm: number }>,
): VideoPlan {
  validateVideoOptions(options, page);
  const posterAspect = page.widthMm / page.heightMm;
  const aspect = options.aspect === 'page' ? posterAspect : ASPECTS[options.aspect];
  if (!Number.isFinite(aspect) || aspect <= 0) throw new Error('Choose a supported video aspect ratio.');
  const edge = options.quality === 'high' ? 1920 : 1280;
  const pixels = options.quality === 'high' ? 1920 * 1080 : 1280 * 720;
  const height = Math.floor(Math.min(edge, edge / aspect, Math.sqrt(pixels / aspect)) / 2) * 2;
  const width = Math.floor(height * aspect / 2) * 2;
  if (Math.min(width, height) < 64) throw new Error('This poster is too narrow for video. Use a less extreme page aspect ratio.');
  const posterScale = Math.min(width / page.widthMm, height / page.heightMm);
  const posterWidth = Math.floor(page.widthMm * posterScale);
  const posterHeight = Math.floor(page.heightMm * posterScale);
  if (Math.min(posterWidth, posterHeight) < 64) throw new Error('This poster is too narrow to remain readable in the selected video aspect.');
  const bitrate = (options.quality === 'high' ? 12_000_000 : 6_000_000) * (options.fps / 30);
  return {
    options: { ...options },
    width,
    height,
    poster: {
      x: Math.floor((width - posterWidth) / 2),
      y: Math.floor((height - posterHeight) / 2),
      width: posterWidth,
      height: posterHeight,
    },
    bitrate,
    expectedFrames: options.durationSeconds * options.fps,
    maxBytes: Math.ceil(bitrate * options.durationSeconds / 8 * 2 + 1024 * 1024),
  };
}
