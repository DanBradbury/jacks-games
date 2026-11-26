// Entry Worker. Static files come from the assets binding; this only handles /api/*.
//   POST /api/rooms            { familyFriendly } → { code }
//   GET  /api/rooms/:code      → 200 if the room exists, 404 if not
//   GET  /api/rooms/:code/ws   → WebSocket into the room's Durable Object
import { Room } from './room.ts';

export { Room };

interface Env {
  ROOMS: DurableObjectNamespace<Room>;
}

// Consonants only, so a random code can't spell a rude word at the family table.
const LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
const newCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean); // ['api', 'rooms', code?, 'ws'?]
    if (parts[0] !== 'api' || parts[1] !== 'rooms') return json({ error: 'Not found' }, 404);

    if (parts.length === 2 && req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as { familyFriendly?: unknown };
      const familyFriendly = body.familyFriendly !== false;
      for (let i = 0; i < 10; i++) {
        const code = newCode();
        const ok = await env.ROOMS.get(env.ROOMS.idFromName(code)).init(code, { familyFriendly });
        if (ok) return json({ code });
      }
      return json({ error: 'Could not make a room, try again.' }, 503);
    }

    const code = parts[2]?.toUpperCase();
    if (!code || !/^[A-Z]{4}$/.test(code)) return json({ error: 'Bad room code' }, 400);
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    if (parts.length === 3 && req.method === 'GET') return (await stub.exists()) ? json({ code }) : json({ error: 'No such room' }, 404);
    if (parts.length === 4 && parts[3] === 'ws') return stub.fetch(req);
    return json({ error: 'Not found' }, 404);
  },
} satisfies ExportedHandler<Env>;
