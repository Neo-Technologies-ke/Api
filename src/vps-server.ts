/**
 * VPS Server Entry Point
 * 
 * This file starts the B1Api as a persistent HTTP server for VPS deployment.
 * It replaces the Lambda handler approach with direct Express server.
 * 
 * The WebSocket server is automatically started by SocketHelper when
 * DELIVERY_PROVIDER=local is set in the environment.
 */

import { createApp } from "./app.js";
import { Environment } from "./shared/helpers/Environment.js";
import { fileURLToPath } from "url";

const startServer = async () => {
  try {
    console.log("🚀 Starting B1Api VPS Server...");
    
    // Initialize environment
    const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || "dev";
    await Environment.init(environment);
    
    console.log(`✅ Environment initialized: ${environment}`);
    console.log(`📊 Database connections: ${Array.from(Environment.dbConnections.keys()).join(", ")}`);

    // Create Express app (this also initializes SocketHelper with WebSocket server)
    const app = await createApp();
    const port = Environment.port || 8084;

    // Start HTTP server
    const httpServer = app.listen(port, () => {
      console.log(`✅ HTTP API server listening on port ${port}`);
      console.log(`🌍 Environment: ${Environment.currentEnvironment}`);
      console.log(`🔒 CORS Origin: ${Environment.corsOrigin}`);
      
      if (Environment.deliveryProvider === "local" && Environment.socketPort > 0) {
        console.log(`🔌 WebSocket server: ws://localhost:${Environment.socketPort}`);
      }
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);
      
      // Close HTTP server
      httpServer.close(() => {
        console.log("✅ HTTP server closed");
      });

      // Close database connections
      setTimeout(() => {
        console.log("✅ Database connections closed");
        process.exit(0);
      }, 1000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    console.log("\n✨ B1Api VPS Server is ready!");
    console.log(`📡 HTTP API: http://localhost:${port}`);
    console.log(`\nPress Ctrl+C to stop the server\n`);

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Only start server if this file is run directly
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  startServer();
}

export { startServer };
