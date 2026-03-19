import type { RTCPeerConnection, RTCDataChannel } from "werift";

export interface PlayerConnection {
  pc: RTCPeerConnection;
  positionChannel: RTCDataChannel | null;
  reliableChannel: RTCDataChannel | null;
  accountId: string;
  characterId: string;
  entityId: string;
}

class ConnectionManager {
  private connections = new Map<string, PlayerConnection>();

  add(conn: PlayerConnection) { this.connections.set(conn.entityId, conn); }

  remove(entityId: string) {
    const conn = this.connections.get(entityId);
    if (conn) {
      conn.pc.close().catch((err) => {
        console.error(`[WebRTC] Failed to close PC for ${entityId}:`, err);
      });
      conn.positionChannel = null;
      conn.reliableChannel = null;
      this.connections.delete(entityId);
    }
  }

  get(entityId: string) { return this.connections.get(entityId); }
  getAll(): PlayerConnection[] { return Array.from(this.connections.values()); }

  sendReliable(entityId: string, data: string) {
    const conn = this.connections.get(entityId);
    if (conn?.reliableChannel?.readyState === "open") {
      conn.reliableChannel.send(Buffer.from(data));
    }
  }

  sendPosition(entityId: string, data: Buffer) {
    const conn = this.connections.get(entityId);
    if (conn?.positionChannel?.readyState === "open") {
      conn.positionChannel.send(data);
    }
  }

  broadcastReliable(data: string, exclude?: string) {
    for (const conn of this.connections.values()) {
      if (conn.entityId !== exclude && conn.reliableChannel?.readyState === "open") {
        conn.reliableChannel.send(Buffer.from(data));
      }
    }
  }
}

export const connectionManager = new ConnectionManager();
