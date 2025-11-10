
import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";

// Load .env
dotenv.config();

import routesData from "./routes/routesData";

const app = express();
const PORT = Number(process.env.PORT);

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", routesData);

// Root route
app.get("/", (req: Request, res: Response) => {
  res.send("Backend is running...");
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://${PORT}`);
});
