// PixSnap Worker - Image storage service

import { Env } from '../types';

/**
 * Generate a unique R2 key for an image
 */
export function generateR2Key(id: string, ext: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}/${month}/${id}.${ext}`;
}

/**
 * Store an image in R2
 */
export async function storeImage(
  env: Env,
  key: string,
  data: ArrayBuffer | ReadableStream,
  contentType: string
): Promise<void> {
  await env.IMAGES_BUCKET.put(key, data, {
    httpMetadata: { contentType },
  });
}

/**
 * Get an image from R2
 */
export async function getImage(env: Env, key: string): Promise<R2ObjectBody | null> {
  return env.IMAGES_BUCKET.get(key);
}

/**
 * Delete an image from R2
 */
export async function deleteImage(env: Env, key: string): Promise<void> {
  await env.IMAGES_BUCKET.delete(key);
}

/**
 * Map MIME type to file extension
 */
export function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/avif': 'avif',
    'image/tiff': 'tiff',
  };
  return map[mime] || 'bin';
}

/**
 * Guess MIME type from URL or default
 */
export function guessContentType(url: string): string {
  const lower = url.toLowerCase().split('?')[0];
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.avif')) return 'image/avif';
  return 'image/jpeg'; // default
}
