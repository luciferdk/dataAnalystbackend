// src/app.ts

import express, {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import dotenv from "dotenv";
import cors from "cors";
import os from "os";
import cluster, { Worker } from "cluster";
import helmet from "helmet";
import compression from "compression";
import createAPIRateLimiter from "./services/rateLimiter";

// load .env
dotenv.config();

import routesdata from "./routes/routesData";
import pool from "./config/database";
import { closeRedisConnection } from "./config/redis";

const port = Number(process.env.PORT);

// get cpus in production, 2 in dev for testing
const numcpus = process.env.NODE_ENV === "production" ? os.cpus().length : 2;

if (cluster.isPrimary) {
  console.log(`primary ${process.pid} is running with ${numcpus} workers`);
  const workers: Worker[] = [];

  // fork workers
  for (let i = 0; i < numcpus; i++) {
    const worker = cluster.fork();
    workers.push(worker);
  }

  // load balancing simulation - round robin

  cluster.on("message", (worker, message) => {
    if (message.type === "request_handled") {
      console.log(`worker ${worker.process.pid} handled request`);
    }
  });

  cluster.on(`exit`, (worker, _code, _signal) => {
    console.log(`worker ${worker.process.pid} died. restarting...`);
    const newworker = cluster.fork();
    const index = workers.indexOf(worker);
    if (index > -1) {
      workers[index] = newworker;
    }
  });

  //Graceful shutdown for primary
  const shutdownPrimary = (signal: string): void => {
    console.log(`Primary received ${signal}, shutting down workers...`);

    for (const worker of workers) {
      worker.kill();
    }

    setTimeout(() => {
      console.log("Forcing shutdown");
      process.exit(0);
    }, 30000);
  };
  process.on("SIGINT", () => shutdownPrimary("SIGINT"));
  process.on("SIGTERM", () => shutdownPrimary("SIGTERM"));
} else {
  setupServer();
}

async function setupServer(): Promise<void> {
  const app = express();

  //rate limiting
  let apiLimiter: RequestHandler;
  try {
    apiLimiter = await createAPIRateLimiter();
    console.log(`✅ Worker ${process.pid}: Rate limiter initialized`);
  } catch (err) {
    console.error(
      `❌ Worker ${process.pid}: Failed to initialize rate limiter:`,
      err,
    );
    process.exit(1);
  }

  // security middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, //adjust based on your need
      crossOriginEmbedderPolicy: false,
    }),
  );

  //compression middleware with better settings
  app.use(
    compression({
      level: 6,
      threshold: 1000,
    }),
  );

  // cors with specific origins for production
  app.use(
    cors({
      origin:
        process.env.NODE_ENV === "production"
          ? ["https://yourdomain.com"]
          : ["http://localhost:5173"],
      credentials: true,
      methods: ["GET", "POST"],
      maxAge: 86400, //24 hours
    }),
  );

  //body parser with optimized limits
  app.use(
    express.json({
      limit: "1mb", // reduced for better performance
    }),
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: "1mb",
    }),
  );

  // request logging with performance tracking
  app.use((req: Request, res: Response, _next: NextFunction): void => {
    const start = process.hrtime();

    res.on("finish", (): void => {
      const duration = process.hrtime(start);
      const durationMs = (duration[0] * 1000 + duration[1] / 1000000).toFixed(
        2,
      );

      // only log slow requests or errors in production
      if (
        process.env.NODE_ENV !== "production" ||
        Number(durationMs) > 1000 ||
        res.statusCode >= 400
      ) {
        console.log(
          `worker ${process.pid} | ${req.method} ${req.url} | ${res.statusCode} ${durationMs}ms`,
        );
      }
    });
    _next();
  });

  // Apply rate limiter to API routes
  app.use("/api", apiLimiter, routesdata);

  // root route
  app.get("/", (req: Request, res: Response): void => {
    const health = {
      status: "healthy",
      worker: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };

    //notify primary
    if (process.send) {
      process.send({ type: "backend_is_working_great", worker: process.pid });
    }
    res.json(health);
  });

  //error handling
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error(`worker ${process.pid} error:`, err.stack);
    res.status(500).json({
      error: "internal server error",
      worker: process.pid,
    });
  });

  // start server with keep-alive timeout adjustment
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(
      `✅ worker ${process.pid} server running on http://localhost:${port}`,
    );
  });

  //Server for high traffic
  server.keepAliveTimeout = 30000; //30 seconds
  server.headersTimeout = 31000; //31 seconds should be higher then keepAliveTimeout
  server.maxHeadersCount = 2000;

  //increase connection limit
  server.maxConnections = Number(process.env.MAX_CONNECTIONS) || 10000;

  //graceful shutdown
  const gracefulShutdown = (signal: string): void => {
    console.log(`🛑 worker ${process.pid} received ${signal} shutting down...`);
    server.close(() => {
      (async (): Promise<void> => {
        try {
          //Close Redis connection
          await closeRedisConnection();

          //Close database pool
          await pool.end();
          console.log(` Woeker ${process.pid} closed database pool`);
          process.exit(0);
        } catch (err) {
          console.error(`Worker ${process.pid}} error during shutdown:`, err);
          process.exit(1);
        }
      })();
    });
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}
