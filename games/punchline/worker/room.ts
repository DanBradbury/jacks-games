// One Durable Object per room code. Holds the live Game in memory and a socket per
// browser. Only the room's existence + settings are persisted, so a room that sat idle
// long enough to be evicted comes back as a fresh lobby at the same link.
import { DurableObject } from 'cloudflare:workers';
import type { ClientMsg, ServerMsg, Settings } from '../src/protocol.ts';
import { Game, GameError } from './game.ts';

interface Meta {
  code: string;
  settings: Settings;
}

/** Rooms are forgotten a day after the last activity. */
const ROOM_TTL = 24 * 60 * 60 * 1000;

export class Room extends DurableObject {
  private game: Game | null = null;
  private sockets = new Map<WebSocket, string | null>();
  private pending = false;

  async init(code: string, settings: Settings): Promise<boolean> {
    if (await this.ctx.storage.get<Meta>('meta')) return false;
    await this.ctx.storage.put<Meta>('meta', { code, settings });
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL);
    return true;
  }

  async exists(): Promise<boolean> {
    return !!(await this.load());
  }

  async alarm() {
    if (this.sockets.size) return void (await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL));
    await this.ctx.storage.deleteAll();
    this.game = null;
  }

  private async load(): Promise<Game | null> {
    if (this.game) return this.game;
    const meta = await this.ctx.storage.get<Meta>('meta');
    if (!meta) return null;
    this.game = new Game(meta.code, meta.settings, {
      now: () => Date.now(),
      schedule: (ms, fn) => {
        const t = setTimeout(fn, ms);
        return () => clearTimeout(t);
      },
      changed: () => this.broadcastSoon(),
    });
    return this.game;
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    const game = await this.load();
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    if (!game) {
      this.send(server, { t: 'error', message: "That room doesn't exist (or it expired).", fatal: true });
      server.close(4004, 'no room');
      return new Response(null, { status: 101, webSocket: client });
    }
    this.sockets.set(server, null);
    server.addEventListener('message', (e) => this.onMessage(server, game, e.data));
    const gone = () => {
      const id = this.sockets.get(server);
      this.sockets.delete(server);
      // Only mark offline if this player has no other tab open.
      if (id && ![...this.sockets.values()].includes(id)) game.disconnect(id);
    };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    void this.ctx.storage.setAlarm(Date.now() + ROOM_TTL);
    return new Response(null, { status: 101, webSocket: client });
  }

  private onMessage(ws: WebSocket, game: Game, raw: unknown) {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    const me = this.sockets.get(ws) ?? null;
    try {
      if (msg.t === 'join') {
        const id = game.join(String(msg.name ?? ''), msg.playerId, () => crypto.randomUUID());
        this.sockets.set(ws, id);
        this.send(ws, { t: 'welcome', playerId: id });
        this.broadcastSoon();
        return;
      }
      if (!me) return;
      switch (msg.t) {
        case 'settings':
          return game.setSettings(me, msg.settings);
        case 'start':
          return game.start(me);
        case 'answer':
          return game.answer(me, msg.promptId, String(msg.text ?? ''));
        case 'safety':
          return game.safety(me, msg.promptId);
        case 'vote':
          return game.vote(me, Array.isArray(msg.answerIds) ? msg.answerIds.map(String) : []);
        case 'skip':
          return game.skip(me);
        case 'again':
          return game.again(me);
      }
    } catch (err) {
      if (!(err instanceof GameError)) throw err;
      this.send(ws, { t: 'error', message: err.message });
    }
  }

  /** Coalesce bursts of changes into one state push per socket. */
  private broadcastSoon() {
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      const game = this.game;
      if (!game) return;
      for (const [ws, id] of this.sockets) if (id) this.send(ws, { t: 'state', state: game.view(id) });
    });
  }

  private send(ws: WebSocket, msg: ServerMsg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // socket already closed; its close handler cleans up
    }
  }
}
