// PixSnap Worker - Image listing, detail, update, delete routes

import { Env, ImageRecord, ImageListResponse, TagCount } from '../types';
import { getImage, deleteImage } from '../services/storage';

/**
 * GET /api/images - List images with pagination and filtering
 */
export async function handleList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '40')));
  const search = url.searchParams.get('search') || '';
  const tag = url.searchParams.get('tag') || '';
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params: unknown[] = [];

  const conditions: string[] = [];

  if (search) {
    conditions.push(`(filename LIKE ? OR page_title LIKE ? OR tags LIKE ?)`);
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }

  if (tag) {
    // Match tag within JSON array string
    conditions.push(`tags LIKE ?`);
    params.push(`%"${tag}"%`);
  }

  if (conditions.length > 0) {
    whereClause = `WHERE ${conditions.join(' AND ')}`;
  }

  // Get total count
  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM images ${whereClause}`
  )
    .bind(...params)
    .first<{ total: number }>();

  const total = countResult?.total || 0;

  // Get page of images
  const images = await env.DB.prepare(
    `SELECT * FROM images ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(...params, limit, offset)
    .all<ImageRecord>();

  const response: ImageListResponse = {
    images: images.results || [],
    total,
    page,
    limit,
  };

  return Response.json(response);
}

/**
 * GET /api/images/:id - Get single image metadata
 */
export async function handleGetOne(id: string, env: Env): Promise<Response> {
  const image = await env.DB.prepare('SELECT * FROM images WHERE id = ?')
    .bind(id)
    .first<ImageRecord>();

  if (!image) {
    return Response.json({ error: 'Image not found' }, { status: 404 });
  }

  return Response.json(image);
}

/**
 * GET /api/images/:id/file - Stream the actual image binary
 */
export async function handleGetFile(id: string, env: Env): Promise<Response> {
  const image = await env.DB.prepare('SELECT r2_key, content_type, filename FROM images WHERE id = ?')
    .bind(id)
    .first<{ r2_key: string; content_type: string; filename: string }>();

  if (!image) {
    return Response.json({ error: 'Image not found' }, { status: 404 });
  }

  const object = await getImage(env, image.r2_key);
  if (!object) {
    return Response.json({ error: 'Image file not found in storage' }, { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': image.content_type,
      'Content-Length': object.size.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': `inline; filename="${image.filename}"`,
    },
  });
}

/**
 * PATCH /api/images/:id - Update image metadata
 */
export async function handleUpdate(id: string, request: Request, env: Env): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM images WHERE id = ?')
    .bind(id)
    .first();

  if (!existing) {
    return Response.json({ error: 'Image not found' }, { status: 404 });
  }

  const body = await request.json<{
    tags?: string[];
    page_title?: string;
    source_url?: string;
  }>();

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.tags !== undefined) {
    updates.push('tags = ?');
    values.push(JSON.stringify(body.tags));
  }
  if (body.page_title !== undefined) {
    updates.push('page_title = ?');
    values.push(body.page_title);
  }
  if (body.source_url !== undefined) {
    updates.push('source_url = ?');
    values.push(body.source_url);
  }

  if (updates.length === 0) {
    return Response.json({ error: 'No updates provided' }, { status: 400 });
  }

  values.push(id);
  await env.DB.prepare(`UPDATE images SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  // Return updated record
  const updated = await env.DB.prepare('SELECT * FROM images WHERE id = ?')
    .bind(id)
    .first<ImageRecord>();

  return Response.json(updated);
}

/**
 * DELETE /api/images/:id - Delete image
 */
export async function handleDelete(id: string, env: Env): Promise<Response> {
  const image = await env.DB.prepare('SELECT r2_key FROM images WHERE id = ?')
    .bind(id)
    .first<{ r2_key: string }>();

  if (!image) {
    return Response.json({ error: 'Image not found' }, { status: 404 });
  }

  // Delete from R2
  await deleteImage(env, image.r2_key);

  // Delete from D1
  await env.DB.prepare('DELETE FROM images WHERE id = ?').bind(id).run();

  return Response.json({ success: true });
}

/**
 * GET /api/tags - List all unique tags with counts
 */
export async function handleTags(env: Env): Promise<Response> {
  const allImages = await env.DB.prepare('SELECT tags FROM images')
    .all<{ tags: string }>();

  const tagCounts = new Map<string, number>();

  for (const row of allImages.results || []) {
    try {
      const tags: string[] = JSON.parse(row.tags || '[]');
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    } catch {
      // Skip malformed tags
    }
  }

  const tags: TagCount[] = [...tagCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return Response.json({ tags });
}
