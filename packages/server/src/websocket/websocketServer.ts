import { Server as HttpServer } from 'http';
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { eventBus, AppEvent } from './eventBus';

interface ClientInfo {
  ws: WebSocket;
  subscribedSources: Set<string>; // Source account IDs
  isAlive: boolean;
}

export class WebSocketServerManager {
  private wss: WSServer | null = null;
  private clients: Map<WebSocket, ClientInfo> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  initialize(server: HttpServer): void {
    this.wss = new WSServer({ server, path: '/ws' });

    console.log('[WebSocket] Server initialized on /ws');

    this.wss.on('connection', (ws) => {
      console.log('[WebSocket] Client connected');

      const clientInfo: ClientInfo = {
        ws,
        subscribedSources: new Set(),
        isAlive: true,
      };

      this.clients.set(ws, clientInfo);

      // Send welcome message with current stream status
      this.sendToClient(ws, {
        type: 'connected',
        message: 'WebSocket connection established',
        timestamp: new Date().toISOString(),
      });

      ws.on('message', (data) => {
        this.handleClientMessage(ws, data.toString());
      });

      ws.on('pong', () => {
        clientInfo.isAlive = true;
      });

      ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('[WebSocket] Client error:', err);
        this.clients.delete(ws);
      });
    });

    // Set up ping interval to keep connections alive
    this.pingInterval = setInterval(() => {
      this.clients.forEach((clientInfo, ws) => {
        if (!clientInfo.isAlive) {
          console.log('[WebSocket] Terminating inactive client');
          ws.terminate();
          this.clients.delete(ws);
          return;
        }

        clientInfo.isAlive = false;
        ws.ping();
      });
    }, 30000);

    // Subscribe to all events from the event bus
    eventBus.onAny((event: AppEvent) => {
      this.broadcastEvent(event);
    });
  }

  private handleClientMessage(ws: WebSocket, message: string): void {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'subscribe':
          // Subscribe to specific source account updates
          if (data.sourceAccountId) {
            const clientInfo = this.clients.get(ws);
            if (clientInfo) {
              clientInfo.subscribedSources.add(data.sourceAccountId);
              console.log(
                `[WebSocket] Client subscribed to source ${data.sourceAccountId}`
              );
            }
          }
          break;

        case 'unsubscribe':
          // Unsubscribe from source account updates
          if (data.sourceAccountId) {
            const clientInfo = this.clients.get(ws);
            if (clientInfo) {
              clientInfo.subscribedSources.delete(data.sourceAccountId);
            }
          }
          break;

        case 'ping':
          // Respond to client ping
          this.sendToClient(ws, { type: 'pong', timestamp: new Date().toISOString() });
          break;
      }
    } catch (err) {
      console.error('[WebSocket] Failed to parse client message:', message);
    }
  }

  private broadcastEvent(event: AppEvent): void {
    const message = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    const sourceAccountId =
      'sourceAccountId' in event ? event.sourceAccountId?.toString() : undefined;

    this.clients.forEach((clientInfo) => {
      // If event has a sourceAccountId, only send to subscribed clients
      // If no sourceAccountId, send to all clients
      if (sourceAccountId) {
        if (
          clientInfo.subscribedSources.size === 0 ||
          clientInfo.subscribedSources.has(sourceAccountId)
        ) {
          this.sendToClient(clientInfo.ws, message);
        }
      } else {
        this.sendToClient(clientInfo.ws, message);
      }
    });
  }

  private sendToClient(ws: WebSocket, data: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  broadcast(data: unknown): void {
    const message = JSON.stringify(data);

    this.clients.forEach((clientInfo) => {
      if (clientInfo.ws.readyState === WebSocket.OPEN) {
        clientInfo.ws.send(message);
      }
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }

  shutdown(): void {
    console.log('[WebSocket] Shutting down server');

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    this.clients.forEach((clientInfo) => {
      clientInfo.ws.close(1000, 'Server shutting down');
    });

    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

// Singleton instance
export const websocketServer = new WebSocketServerManager();
