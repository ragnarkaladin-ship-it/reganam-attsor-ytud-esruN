
import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { db } from "./services/db";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Initialize Database
  try {
    await db.init();
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Failed to initialize database:", err);
  }

  // API Routes
  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const result = await db.login(email, password);
      if (result) {
        res.json({ success: true, ...result });
      } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
      }
    } catch (err) {
      res.status(500).json({ success: false, message: "Server error" });
    }
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
      res.json(nurse);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/nurses/:id", async (req, res) => {
    try {
      const nurse = await db.updateNurse(parseInt(req.params.id), req.body);
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
      for (const d of toDelete) {
        await db.deleteDuty(d.id);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/duties/:id", async (req, res) => {
    try {
      const duty = await db.updateDuty(parseInt(req.params.id), req.body);
      res.json(duty);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/duties/:id", async (req, res) => {
    try {
      await db.deleteDuty(parseInt(req.params.id));
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
      res.json(message);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/messages/:id", async (req, res) => {
    try {
      const message = await db.updateMessage(parseInt(req.params.id), req.body);
      res.json(message);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
