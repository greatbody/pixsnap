// PixSnap Worker - URL fetch route (Mode 2: Server-side fetch)

import { Env, ImageRecord } from '../types';
import { generateR2Key, storeImage, mimeToExt, guessContentType } from '../services/storage';

export async function handleFetch(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    url: string;
    source_url?: string;
    page_title?: string;
    tags?: string[];
  }>();

  if (!body.url) {
    return Response.json({ error: 'Missing image URL' }, { status: 400 });
  }

  // Fetch the image from the remote URL
  let imageResponse: globalThis.Response;
  try {
    imageResponse = await fetch(body.url, {
      headers: {
        'User-Agent': 'PixSnap/1.0',
        'Accept': 'image/*,*/*',
      },
    });
  } catch (err) {
    return Response.json(
      { error: `Failed to fetch image from URL: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  if (!imageResponse.ok) {
    return Response.json(
      { error: `Remote server returned ${imageResponse.status}` },
      { status: 502 }
    );
  }

  const contentType =
    imageResponse.headers.get('content-type')?.split(';')[0]?.trim() ||
    guessContentType(body.url);

  const arrayBuffer = await imageResponse.arrayBuffer();
  const size = arrayBuffer.byteLength;

  if (size === 0) {
    return Response.json({ error: 'Fetched image is empty' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const ext = mimeToExt(contentType);

  // Try to extract filename from URL
  let filename = '';
  try {
    const urlPath = new URL(body.url).pathname;
    const segments = urlPath.split('/').filter(Boolean);
    if (segments.length > 0) {
      filename = segments[segments.length - 1];
    }
  } catch {}
  if (!filename) {
    filename = `fetched-${Date.now()}.${ext}`;
  }

  const r2Key = generateR2Key(id, ext);

  // Store in R2
  await storeImage(env, r2Key, arrayBuffer, contentType);

  // Metadata
  const sourceUrl = body.source_url || '';
  const pageTitle = body.page_title || '';
  const tags = JSON.stringify(body.tags || []);

  // Insert into D1
  await env.DB.prepare(
    `INSERT INTO images (id, filename, content_type, size, source_url, page_title, r2_key, tags, capture_mode, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'remote', datetime('now'))`
  )
    .bind(id, filename, contentType, size, sourceUrl, pageTitle, r2Key, tags)
    .run();

  const record: ImageRecord = {
    id,
    filename,
    content_type: contentType,
    size,
    width: null,
    height: null,
    source_url: sourceUrl,
    page_title: pageTitle,
    r2_key: r2Key,
    tags,
    capture_mode: 'remote',
    created_at: new Date().toISOString(),
  };

  return Response.json(record, { status: 201 });
}
