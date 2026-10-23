// Photo import for the product editor. The file is checked (type, size), decoded by the browser and
// redrawn on a canvas: re-encoding drops EXIF metadata (GPS position, camera) and anything hidden in
// the original file, and a file that is not really an image fails to decode.
export type ImageProblem = 'type' | 'size' | 'decode';
export class ImageError extends Error {
  constructor(public readonly problem: ImageProblem) { super(problem); }
}

export const MAX_UPLOAD = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Basic checks, separate so they can be unit-tested without a canvas. */
export function checkImageFile(file: { type: string; size: number }): ImageProblem | null {
  if (!TYPES.includes(file.type)) return 'type';
  if (file.size > MAX_UPLOAD) return 'size';
  return null;
}

/** Centred square crop, at most 640 px, as a WebP (or JPEG where WebP encoding is missing) data URL. */
export async function reencodeImage(file: File): Promise<string> {
  const problem = checkImageFile(file);
  if (problem) throw new ImageError(problem);
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new ImageError('decode'); }
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(640, side);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('decode');
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  for (const quality of [0.8, 0.6, 0.45]) {
    let url = canvas.toDataURL('image/webp', quality);
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', quality + 0.02);
    if (url.length <= 400_000) return url;
  }
  throw new ImageError('size');
}
