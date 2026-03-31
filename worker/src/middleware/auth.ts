// PixSnap Worker - Authentication middleware

import { Env } from '../types';

export function authenticate(request: Request, env: Env): Response | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.slice(7);
  if (token !== env.API_TOKEN) {
    return new Response(JSON.stringify({ error: 'Invalid API token' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null; // Auth passed
}
