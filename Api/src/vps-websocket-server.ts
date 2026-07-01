/**
 * VPS WebSocket Server
 * 
 * Replaces AWS API Gateway WebSocket with a standalone WebSocket server
 * using the 'ws' library for VPS deployment.
 */

import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Environment } from "./shared/helpers/Environment.js";
import { TypedDB } from "./shared/infrastructure/TypedDB.js";
import { SocketHelper } from "./modules/messaging/helpers/SocketHelper.js";
import { initializeMessagingModule } from "./modules/messaging/index.js";
import { RepoManager } from "./shared/infrastructure/RepoManager.js";

interface ExtendedWebSocket extends WebSocket {
  connectionId?: string;
  isAlive?: boolean;
}

// Store active connections
const connections = new Map<string, ExtendedWebSocket>();

// Generate unique connection ID
function generateConnectionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function createWebSocketServer(port: number): Promise<WebSocketServer> {
  // Initialize messaging module
  await TypedDB.runWithContext("messaging", async () => {
    const repos = await RepoManager.getRepos<any>("messaging");
    initializeMessagingModule(repos);
  });

  const wss = new WebSocketServer({ 
    port,
    perMessageDeflate: false,
    clientTracking: true
  });

  console.log(`🔌 WebSocket server created on port ${port}`);

  // Heartbeat to detect broken connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: ExtendedWebSocket) => {
      if (ws.isAlive === false) {
        console.log(`💔 Terminating dead connection: ${ws.connectionId}`);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // 30 seconds

  wss.on("connection", async (ws: ExtendedWebSocket, req: IncomingMessage) => {
    const connectionId = generateConnectionId();
    ws.connectionId = connectionId;
    ws.isAlive = true;
    
    connections.set(connectionId, ws);
    
    console.log(`✅ WebSocket connection established: ${connectionId}`);
    console.log(`📊 Total connections: ${connections.size}`);

    // Handle pong responses
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // Handle incoming messages
    ws.on("message", async (data: Buffer) => {
      try {
        const message = data.toString();
        console.log(`📨 Message from ${connectionId}:`, message.substring(0, 100));

        // Send connection ID back to client
        const response = {
          churchId: "",
          conversationId: "",
          action: "socketId",
          data: connectionId
        };

        ws.send(JSON.stringify(response));
        
        // Process the message through SocketHelper if needed
        // await TypedDB.runWithContext("messaging", async () => {
        //   await SocketHelper.handleMessage(connectionId, message);
        // });

      } catch (error) {
        console.error(`❌ Error processing message from ${connectionId}:`, error);
      }
    });

    // Handle disconnection
    ws.on("close", async () => {
      console.log(`👋 WebSocket connection closed: ${connectionId}`);
      connections.delete(connectionId);
      
      try {
        await TypedDB.runWithContext("messaging", async () => {
          await SocketHelper.handleDisconnect(connectionId);
        });
      } catch (error) {
        console.error(`❌ Error handling disconnect for ${connectionId}:`, error);
      }
      
      console.log(`📊 Remaining connections: ${connections.size}`);
    });

    // Handle errors
    ws.on("error", (error) => {
      console.error(`❌ WebSocket error for ${connectionId}:`, error);
    });

    // Send initial connection confirmation
    try {
      const welcomeMessage = {
        action: "connected",
        connectionId: connectionId,
        timestamp: new Date().toISOString()
      };
      ws.send(JSON.stringify(welcomeMessage));
    } catch (error) {
      console.error(`❌ Error sending welcome message to ${connectionId}:`, error);
    }
  });

  wss.on("error", (error) => {
    console.error("❌ WebSocket server error:", error);
  });

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
    console.log("🛑 WebSocket server closed");
  });

  // Helper function to broadcast to all connections
  (wss as any).broadcast = (data: string) => {
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  };

  // Helper function to send to specific connection
  (wss as any).sendToConnection = (connectionId: string, data: string): boolean => {
    const ws = connections.get(connectionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
      return true;
    }
    return false;
  };

  return wss;
}

// Export for use in other modules
export { connections };
