// PixSnap Worker - Main entry point

import { Env } from './types';
import { authenticate } from './middleware/auth';
import { corsHeaders, handleCors } from './middleware/cors';
import { handleUpload } from './routes/upload';
import { handleFetch } from './routes/fetch';
import { handleList, handleGetOne, handleGetFile, handleUpdate, handleDelete, handleTags, handleRenameTag } from './routes/images';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    const corsResponse = handleCors(request, env);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Health check (no auth required)
    if (path === '/api/health' && method === 'GET') {
      return withCors(request, env, Response.json({ status: 'ok', version: '1.0.0' }));
    }

    // Authenticate all other API routes
    const authError = authenticate(request, env);
    if (authError) {
      return withCors(request, env, authError);
    }

    try {
      let response: Response;

      // Route matching
      if (path === '/api/images/upload' && method === 'POST') {
        response = await handleUpload(request, env);
      } else if (path === '/api/images/fetch' && method === 'POST') {
        response = await handleFetch(request, env);
      } else if (path === '/api/images' && method === 'GET') {
        response = await handleList(request, env);
      } else if (path === '/api/tags' && method === 'GET') {
        response = await handleTags(env);
      } else {
        // Match /api/tags/:name (rename tag)
        const tagMatch = path.match(/^\/api\/tags\/(.+)$/);
        // Match /api/images/:id and /api/images/:id/file
        const imageMatch = path.match(/^\/api\/images\/([a-f0-9-]+)$/);
        const fileMatch = path.match(/^\/api\/images\/([a-f0-9-]+)\/file$/);

        if (tagMatch && method === 'PATCH') {
          response = await handleRenameTag(decodeURIComponent(tagMatch[1]), request, env);
        } else if (fileMatch && method === 'GET') {
          response = await handleGetFile(fileMatch[1], env);
        } else if (imageMatch) {
          const id = imageMatch[1];
          if (method === 'GET') {
            response = await handleGetOne(id, env);
          } else if (method === 'PATCH') {
            response = await handleUpdate(id, request, env);
          } else if (method === 'DELETE') {
            response = await handleDelete(id, env);
          } else {
            response = Response.json({ error: 'Method not allowed' }, { status: 405 });
          }
        } else {
          response = Response.json({ error: 'Not found' }, { status: 404 });
        }
      }

      return withCors(request, env, response);
    } catch (err) {
      console.error('[PixSnap Worker]', err);
      return withCors(
        request,
        env,
        Response.json(
          { error: 'Internal server error' },
          { status: 500 }
        )
      );
    }
  },
} satisfies ExportedHandler<Env>;

/**
 * Attach CORS headers to a response
 */
function withCors(request: Request, env: Env, response: Response): Response {
  const headers = corsHeaders(request, env);
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(headers)) {
    if (value) newResponse.headers.set(key, value);
  }
  return newResponse;
}
