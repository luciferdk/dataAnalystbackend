"use strict";
// src/app.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const os_1 = __importDefault(require("os"));
const cluster_1 = __importDefault(require("cluster"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const rateLimiter_1 = __importDefault(require("./services/rateLimiter"));
// load .env
dotenv_1.default.config();
const routesData_1 = __importDefault(require("./routes/routesData"));
const database_1 = __importDefault(require("./config/database"));
const redis_1 = require("./config/redis");
const port = Number(process.env.PORT);
// get cpus in production, 2 in dev for testing
const numcpus = process.env.NODE_ENV === "production" ? os_1.default.cpus().length : 2;
if (cluster_1.default.isPrimary) {
    console.log(`primary ${process.pid} is running with ${numcpus} workers`);
    const workers = [];
    // fork workers
    for (let i = 0; i < numcpus; i++) {
        const worker = cluster_1.default.fork();
        workers.push(worker);
    }
    // load balancing simulation - round robin
    cluster_1.default.on("message", (worker, message) => {
        if (message.type === "request_handled") {
            console.log(`worker ${worker.process.pid} handled request`);
        }
    });
    cluster_1.default.on(`exit`, (worker, _code, _signal) => {
        console.log(`worker ${worker.process.pid} died. restarting...`);
        const newworker = cluster_1.default.fork();
        const index = workers.indexOf(worker);
        if (index > -1) {
            workers[index] = newworker;
        }
    });
    //Graceful shutdown for primary
    const shutdownPrimary = (signal) => {
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
}
else {
    setupServer();
}
async function setupServer() {
    const app = (0, express_1.default)();
    //rate limiting
    let apiLimiter;
    try {
        apiLimiter = await (0, rateLimiter_1.default)();
        console.log(`✅ Worker ${process.pid}: Rate limiter initialized`);
    }
    catch (err) {
        console.error(`❌ Worker ${process.pid}: Failed to initialize rate limiter:`, err);
        process.exit(1);
    }
    // security middleware
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false, //adjust based on your need
        crossOriginEmbedderPolicy: false,
    }));
    //compression middleware with better settings
    app.use((0, compression_1.default)({
        level: 6,
        threshold: 1000,
    }));
    // cors with specific origins for production
    app.use((0, cors_1.default)({
        origin: process.env.NODE_ENV === "production"
            ? ["https://yourdomain.com"]
            : ["http://localhost:5173"],
        credentials: true,
        methods: ["GET", "POST"],
        maxAge: 86400, //24 hours
    }));
    //body parser with optimized limits
    app.use(express_1.default.json({
        limit: "1mb", // reduced for better performance
    }));
    app.use(express_1.default.urlencoded({
        extended: true,
        limit: "1mb",
    }));
    // request logging with performance tracking
    app.use((req, res, _next) => {
        const start = process.hrtime();
        res.on("finish", () => {
            const duration = process.hrtime(start);
            const durationMs = (duration[0] * 1000 + duration[1] / 1000000).toFixed(2);
            // only log slow requests or errors in production
            if (process.env.NODE_ENV !== "production" ||
                Number(durationMs) > 1000 ||
                res.statusCode >= 400) {
                console.log(`worker ${process.pid} | ${req.method} ${req.url} | ${res.statusCode} ${durationMs}ms`);
            }
        });
        _next();
    });
    // Apply rate limiter to API routes
    app.use("/api", apiLimiter, routesData_1.default);
    // root route
    app.get("/", (req, res) => {
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
    app.use((err, req, res, _next) => {
        console.error(`worker ${process.pid} error:`, err.stack);
        res.status(500).json({
            error: "internal server error",
            worker: process.pid,
        });
    });
    // start server with keep-alive timeout adjustment
    const server = app.listen(port, "0.0.0.0", () => {
        console.log(`✅ worker ${process.pid} server running on http://localhost:${port}`);
    });
    //Server for high traffic
    server.keepAliveTimeout = 30000; //30 seconds
    server.headersTimeout = 31000; //31 seconds should be higher then keepAliveTimeout
    server.maxHeadersCount = 2000;
    //increase connection limit
    server.maxConnections = Number(process.env.MAX_CONNECTIONS) || 10000;
    //graceful shutdown
    const gracefulShutdown = (signal) => {
        console.log(`🛑 worker ${process.pid} received ${signal} shutting down...`);
        server.close(() => {
            (async () => {
                try {
                    //Close Redis connection
                    await (0, redis_1.closeRedisConnection)();
                    //Close database pool
                    await database_1.default.end();
                    console.log(` Woeker ${process.pid} closed database pool`);
                    process.exit(0);
                }
                catch (err) {
                    console.error(`Worker ${process.pid}} error during shutdown:`, err);
                    process.exit(1);
                }
            })();
        });
    };
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}
