/**
 * Draws a binary STL as a shaded clay model on a 2D canvas inside the browser.
 * Painter's-algorithm flat shading is enough for a terrain relief and keeps the
 * pipeline free of extra 3D dependencies.
 */
import { readFile } from 'node:fs/promises';
import type { Page } from 'playwright';

export async function renderRelief(page: Page, stlFile: string, output: { width: number; height: number }): Promise<string> {
  const base64 = (await readFile(stlFile)).toString('base64');
  await page.setViewportSize({ width: output.width / 2, height: output.height / 2 });
  await page.setContent('<html><body style="margin:0;background:transparent"><canvas id="c"></canvas></body></html>');
  return page.evaluate(({ data, width, height }) => {
    const bytes = Uint8Array.from(atob(data), (character) => character.codePointAt(0) ?? 0);
    const view = new DataView(bytes.buffer);
    const count = view.getUint32(80, true);
    const vertices = new Float32Array(count * 9);
    for (let index = 0; index < count; index += 1) {
      for (let component = 0; component < 9; component += 1) vertices[index * 9 + component] = view.getFloat32(84 + index * 50 + 12 + component * 4, true);
    }
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
    for (let index = 0; index < vertices.length; index += 3) {
      minX = Math.min(minX, vertices[index]); maxX = Math.max(maxX, vertices[index]);
      minY = Math.min(minY, vertices[index + 1]); maxY = Math.max(maxY, vertices[index + 1]);
      minZ = Math.min(minZ, vertices[index + 2]); maxZ = Math.max(maxZ, vertices[index + 2]);
    }
    const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2;
    const yaw = -0.62; const pitch = 0.95;
    const project = (x: number, y: number, z: number) => {
      const px = x - centerX; const py = y - centerY;
      const rx = px * Math.cos(yaw) - py * Math.sin(yaw);
      const ry = px * Math.sin(yaw) + py * Math.cos(yaw);
      const depth = ry * Math.sin(pitch) - (z - minZ) * Math.cos(pitch);
      const screenY = ry * Math.cos(pitch) + (z - minZ) * Math.sin(pitch);
      return [rx, -screenY, depth];
    };
    const projected = new Float32Array(vertices.length);
    let left = Infinity; let right = -Infinity; let top = Infinity; let bottom = -Infinity;
    for (let index = 0; index < vertices.length; index += 3) {
      const [x, y, depth] = project(vertices[index], vertices[index + 1], vertices[index + 2]);
      projected.set([x, y, depth], index);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    const scale = Math.min(width * 0.86 / (right - left), height * 0.8 / (bottom - top));
    const offsetX = width / 2 - (left + right) / 2 * scale;
    const offsetY = height / 2 - (top + bottom) / 2 * scale;
    const order = Array.from({ length: count }, (_, index) => index);
    const depthOf = (index: number) => projected[index * 9 + 2] + projected[index * 9 + 5] + projected[index * 9 + 8];
    order.sort((a, b) => depthOf(b) - depthOf(a));
    const light = [-0.45, 0.35, 0.82];
    const lightLength = Math.hypot(...light);
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    canvas.width = width; canvas.height = height;
    canvas.style.width = `${width / 2}px`;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.lineJoin = 'round';
    for (const index of order) {
      const base = index * 9;
      const ax = vertices[base + 3] - vertices[base]; const ay = vertices[base + 4] - vertices[base + 1]; const az = vertices[base + 5] - vertices[base + 2];
      const bx = vertices[base + 6] - vertices[base]; const by = vertices[base + 7] - vertices[base + 1]; const bz = vertices[base + 8] - vertices[base + 2];
      const nx = ay * bz - az * by; const ny = az * bx - ax * bz; const nz = ax * by - ay * bx;
      const length = Math.hypot(nx, ny, nz) || 1;
      const lambert = Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / (length * lightLength));
      const shade = 0.5 + 0.5 * lambert;
      const color = `rgb(${Math.round(244 * shade)},${Math.round(238 * shade)},${Math.round(226 * shade)})`;
      context.fillStyle = color; context.strokeStyle = color;
      context.beginPath();
      context.moveTo(projected[base] * scale + offsetX, projected[base + 1] * scale + offsetY);
      context.lineTo(projected[base + 3] * scale + offsetX, projected[base + 4] * scale + offsetY);
      context.lineTo(projected[base + 6] * scale + offsetX, projected[base + 7] * scale + offsetY);
      context.closePath(); context.fill(); context.stroke();
    }
    return canvas.toDataURL('image/png');
  }, { data: base64, width: output.width, height: output.height });
}
