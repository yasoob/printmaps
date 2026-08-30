export function copyNativeMapCanvas(
  rendered: HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const context = output.getContext('2d', { willReadFrequently: true });
  if (!context) {
    output.width = 0;
    output.height = 0;
    throw new Error('The browser cannot copy the native print tile.');
  }
  try {
    context.drawImage(rendered, 0, 0);
  } catch {
    output.width = 0;
    output.height = 0;
    throw new Error('The browser could not capture the native print tile.');
  }
  return output;
}