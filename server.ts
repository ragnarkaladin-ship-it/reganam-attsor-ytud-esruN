
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./services/db";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";

console.log("SERVER.TS STARTING...");
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });
  const PORT = process.env.PORT || 3000;

  // WebSocket broadcast helper
  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  wss.on("connection", (ws) => {
    console.log("New WebSocket connection established");
    ws.send(JSON.stringify({ type: "connected", message: "Real-time roster tracking active" }));
  });

  app.use(cors());
  app.use(express.json());

  app.get("/ping", (req, res) => {
    res.send("pong");
  });

  let dbReady = false;

  // Initialize Database
  try {
    await db.init();
    dbReady = true;
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Failed to initialize database:", err);
  }

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: dbReady ? "ok" : "error", 
      db: process.env.DB_TYPE || 'memory',
      dbReady,
      env: process.env.NODE_ENV || 'development'
    });
  });

  app.get("/api/test", (req, res) => {
    res.json({ success: true, message: "API is reachable" });
  });

  // API Routes
  app.post("/api/login", async (req, res) => {
    console.log(`Login attempt for: ${req.body?.email}`);
    if (!dbReady) {
      console.warn("Login attempt rejected: Database not ready");
      return res.status(503).json({ 
        success: false, 
        message: "Database is not ready. Please check your configuration." 
      });
    }
    const { email, password } = req.body;
    try {
      const result = await db.login(email, password);
      if (result) {
        console.log(`Login successful for: ${email}`);
        res.json({ success: true, ...result });
      } else {
        console.log(`Login failed (invalid credentials) for: ${email}`);
        res.status(401).json({ success: false, message: "Invalid credentials" });
      }
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ 
        success: false, 
        message: "Server error", 
        details: process.env.NODE_ENV === 'development' ? err.message : undefined 
      });
    }
  });

  // Request Logger
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  app.get("/api/nurses", async (req, res) => {
    try {
      const nurses = await db.getNurses();
      res.json(nurses);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/nurses", async (req, res) => {
    try {
      const nurse = await db.addNurse(req.body);
      broadcast({ type: "nurse_added", data: nurse });
      res.json(nurse);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/nurses/:id", async (req, res) => {
    try {
      const nurse = await db.updateNurse(parseInt(req.params.id), req.body);
      broadcast({ type: "nurse_updated", data: nurse });
      res.json(nurse);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/duties", async (req, res) => {
    try {
      const duties = await db.getDuties();
      res.json(duties);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/duties/bulk", async (req, res) => {
    try {
      const duties = req.body;
      const savedDuties = [];
      for (const duty of duties) {
        const savedDuty = await db.addDuty(duty);
        savedDuties.push(savedDuty);
      }
      broadcast({ type: "duties_added", data: savedDuties });
      res.json(savedDuties);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/duties/month/:year/:month", async (req, res) => {
    try {
      const { year, month } = req.params;
      const duties = await db.getDuties();
      const toDelete = duties.filter(d => {
        const date = new Date(d.date);
        return date.getFullYear() === parseInt(year) && date.getMonth() === parseInt(month);
      });
      const deletedIds = [];
      for (const d of toDelete) {
        await db.deleteDuty(d.id);
        deletedIds.push(d.id);
      }
      broadcast({ type: "duties_deleted", data: deletedIds });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/duties/:id", async (req, res) => {
    try {
      const duty = await db.updateDuty(parseInt(req.params.id), req.body);
      broadcast({ type: "duty_updated", data: duty });
      res.json(duty);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/duties/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.deleteDuty(id);
      broadcast({ type: "duty_deleted", data: id });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/messages", async (req, res) => {
    try {
      const messages = await db.getMessages();
      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const message = await db.addMessage(req.body);
      broadcast({ type: "message_added", data: message });
      res.json(message);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/messages/:id", async (req, res) => {
    try {
      const message = await db.updateMessage(parseInt(req.params.id), req.body);
      broadcast({ type: "message_updated", data: message });
      res.json(message);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && process.env.DISABLE_VITE !== "true") {
    console.log("Starting in development mode with Vite middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in production mode...");
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
