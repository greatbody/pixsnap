// PixSnap Worker - Image upload route (Mode 1: Local capture)

import { Env, ImageRecord } from '../types';
import { generateR2Key, storeImage, mimeToExt } from '../services/storage';

export async function handleUpload(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const contentType = file.type || 'application/octet-stream';
  const ext = mimeToExt(contentType);
  const filename = file.name || `capture-${Date.now()}.${ext}`;
  const r2Key = generateR2Key(id, ext);

  const arrayBuffer = await file.arrayBuffer();
  const size = arrayBuffer.byteLength;

  // Store in R2
  await storeImage(env, r2Key, arrayBuffer, contentType);

  // Parse optional metadata
  const sourceUrl = formData.get('source_url')?.toString() || '';
  const pageTitle = formData.get('page_title')?.toString() || '';
  let tags = '[]';
  try {
    const tagsRaw = formData.get('tags')?.toString();
    if (tagsRaw) {
      const parsed = JSON.parse(tagsRaw);
      if (Array.isArray(parsed)) tags = JSON.stringify(parsed);
    }
  } catch {}

  // Insert into D1
  await env.DB.prepare(
    `INSERT INTO images (id, filename, content_type, size, source_url, page_title, r2_key, tags, capture_mode, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'local', datetime('now'))`
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
    capture_mode: 'local',
    created_at: new Date().toISOString(),
  };

  return Response.json(record, { status: 201 });
}
