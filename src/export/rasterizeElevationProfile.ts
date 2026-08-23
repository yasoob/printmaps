export async function rasterizeElevationProfile(
  svg: string,
  width: number,
  height: number,
): Promise<Blob> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => reject(new Error('The browser could not render the elevation profile.')), { once: true });
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The browser could not allocate the elevation profile image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (blob?.type === 'image/png') resolve(blob);
          else reject(new Error('The browser could not encode the elevation profile PNG.'));
        }, 'image/png');
      } catch {
        reject(new Error('The browser could not encode the elevation profile PNG.'));
      }
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
