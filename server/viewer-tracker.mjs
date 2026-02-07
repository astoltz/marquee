// Viewer Tracker — manages connected viewers
//
// Tracks connected WebSocket clients with unique IDs, roles, and metadata.

let nextId = 1;

export class ViewerTracker {
  constructor() {
    this.viewers = new Map(); // id -> { ws, role, connectedAt, metadata }
  }

  add(ws, role = 'viewer', metadata = {}) {
    const id = String(nextId++);
    this.viewers.set(id, {
      ws,
      role,
      connectedAt: new Date(),
      metadata,
    });
    return id;
  }

  remove(id) {
    this.viewers.delete(id);
  }

  removeByWs(ws) {
    for (const [id, viewer] of this.viewers) {
      if (viewer.ws === ws) {
        this.viewers.delete(id);
        return id;
      }
    }
    return null;
  }

  get(id) {
    return this.viewers.get(id);
  }

  getByWs(ws) {
    for (const [id, viewer] of this.viewers) {
      if (viewer.ws === ws) return { id, ...viewer };
    }
    return null;
  }

  count(role) {
    if (!role) return this.viewers.size;
    let n = 0;
    for (const viewer of this.viewers.values()) {
      if (viewer.role === role) n++;
    }
    return n;
  }

  broadcast(data, role) {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    for (const viewer of this.viewers.values()) {
      if (role && viewer.role !== role) continue;
      if (viewer.ws.readyState === 1) { // OPEN
        viewer.ws.send(msg);
      }
    }
  }

  sendTo(id, data) {
    const viewer = this.viewers.get(id);
    if (viewer && viewer.ws.readyState === 1) {
      viewer.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }

  list() {
    const result = [];
    for (const [id, viewer] of this.viewers) {
      result.push({
        id,
        role: viewer.role,
        connectedAt: viewer.connectedAt.toISOString(),
        metadata: viewer.metadata,
      });
    }
    return result;
  }
}
