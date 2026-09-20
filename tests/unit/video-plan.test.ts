import { Blob as NodeBlob } from 'node:buffer';
import { getVideoCapability, verifyMp4Blob } from '../../src/video/capability';
import { videoCameraAt } from '../../src/video/camera';
import { planVideoExport } from '../../src/video/plan';
import type { VideoOptions } from '../../src/video/types';

const options: VideoOptions = { motion: 'orbit', durationSeconds: 10, fps: 30, aspect: 'poster', quality: 'standard' };
const page = { widthMm: 297, heightMm: 210 };
const camera = { center: [179.9, 48] as const, bearing: 170, pitch: 45, zoom: 12 };

describe('video output planning', () => {
  it.each(['poster', '16:9', '9:16', '1:1', '4:5'] as const)('bounds %s dimensions without clipping the poster', (aspect) => {
    const plan = planVideoExport({ ...options, quality: 'high', fps: 60, aspect }, page);
    expect(plan.width % 2).toBe(0);
    expect(plan.height % 2).toBe(0);
    expect(plan.width * plan.height).toBeLessThanOrEqual(1920 * 1080);
    expect(Math.max(plan.width, plan.height)).toBeLessThanOrEqual(1920);
    expect(plan.poster.width / plan.poster.height).toBeCloseTo(page.widthMm / page.heightMm, 2);
    expect(plan.poster.x).toBeGreaterThanOrEqual(0);
    expect(plan.poster.y).toBeGreaterThanOrEqual(0);
    expect(plan.poster.x + plan.poster.width).toBeLessThanOrEqual(plan.width);
    expect(plan.poster.y + plan.poster.height).toBeLessThanOrEqual(plan.height);
    expect(plan.expectedFrames).toBe(600);
  });

  it.each([5, 10, 15] as const)('supports exactly %s second output', (durationSeconds) => {
    expect(planVideoExport({ ...options, durationSeconds }, page).expectedFrames).toBe(durationSeconds * 30);
  });

  it('rejects invalid dimensions, unsupported options, and extreme aspect ratios', () => {
    expect(() => planVideoExport(options, { ...page, widthMm: NaN })).toThrow('dimensions');
    expect(() => planVideoExport(options, { widthMm: 0.01, heightMm: 1000 })).toThrow('too narrow');
    expect(() => planVideoExport({ ...options, durationSeconds: 8 } as unknown as VideoOptions, page)).toThrow('duration');
    expect(() => planVideoExport({ ...options, fps: 24 } as unknown as VideoOptions, page)).toThrow('frame rate');
    expect(() => planVideoExport({ ...options, aspect: 'broken' } as unknown as VideoOptions, page)).toThrow('aspect');
    expect(() => planVideoExport({ ...options, quality: '4k' } as unknown as VideoOptions, page)).toThrow('quality');
  });

  it('captures options without retaining a mutable settings reference', () => {
    const input = { ...options };
    const plan = planVideoExport(input, page);
    input.motion = 'sway';
    expect(plan.options.motion).toBe('orbit');
  });
});

describe('video camera paths', () => {
  it('makes one full orbit and a continuous looping sway, preserving the canonical camera', () => {
    const before = structuredClone(camera);
    expect(videoCameraAt(camera, 'orbit', 0)).toEqual(camera);
    expect(videoCameraAt(camera, 'orbit', 0.5).bearing).toBe(350);
    expect(videoCameraAt(camera, 'orbit', 1).bearing).toBe(530);
    expect(videoCameraAt(camera, 'sway', 0.25).bearing).toBe(188);
    expect(videoCameraAt(camera, 'sway', 0.75).bearing).toBe(152);
    expect(videoCameraAt(camera, 'sway', 1).bearing).toBeCloseTo(camera.bearing);
    expect(videoCameraAt(camera, 'orbit', 0.5).center).not.toBe(camera.center);
    expect(camera).toEqual(before);
  });

  it.each([-1, 1.01, NaN, Infinity])('rejects invalid path progress %s', (progress) => {
    expect(() => videoCameraAt(camera, 'orbit', progress)).toThrow('progress');
  });
});

describe('genuine MP4 capability', () => {
  it('does not substitute WebM and gives explicit missing-browser errors', () => {
    expect(getVideoCapability({ captureStream: true, isTypeSupported: (type) => type.startsWith('video/webm') })).toMatchObject({ supported: false, reason: expect.stringContaining('WebM') });
    expect(getVideoCapability({ captureStream: false, isTypeSupported: undefined })).toMatchObject({ supported: false });
    expect(getVideoCapability({ captureStream: true, isTypeSupported: (type) => type === 'video/mp4' })).toEqual({ supported: true, mimeType: 'video/mp4' });
  });

  it('rejects mislabeled WebM, incomplete files, and a wrong claimed MIME', async () => {
    const blob = (bytes: Uint8Array<ArrayBuffer>, type = 'video/mp4') => new NodeBlob([bytes], { type }) as unknown as Blob;
    const webm = blob(new Uint8Array([0x1A, 0x45, 0xDF, 0xA3]));
    const wrongMime = blob(new Uint8Array(8), 'video/webm');
    const truncated = blob(new Uint8Array([0, 0, 0, 50, 102, 116, 121, 112]));
    await expect(verifyMp4Blob(webm)).rejects.toThrow('complete MP4');
    await expect(verifyMp4Blob(wrongMime)).rejects.toThrow('non-MP4');
    await expect(verifyMp4Blob(truncated)).rejects.toThrow('truncated');
  });
});
