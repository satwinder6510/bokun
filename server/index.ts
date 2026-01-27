import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { initScheduler } from "./scheduler";
import { registerSeoRoutes } from "./seo/routes";
import { trackAICrawl } from "./analytics";

const app = express();

// Parse cookies for session management
app.use(cookieParser());

// Canonical host redirect - redirect www to non-www
const CANONICAL_HOST = process.env.CANONICAL_HOST || 'https://holidays.flightsandpackages.com';
const WWW_HOST = 'www.holidays.flightsandpackages.com';

app.use((req, res, next) => {
  // Only redirect if the hostname matches the www host
  if (req.hostname === WWW_HOST) {
    const redirectUrl = `${CANONICAL_HOST}${req.originalUrl}`;
    return res.redirect(301, redirectUrl);
  }
  next();
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// 301 Redirects for Collections
app.get('/holidays', (req, res) => {
  res.redirect(301, '/collections');
});
app.get('/holidays/:slug', (req, res) => {
  res.redirect(301, `/collections/${req.params.slug}`);
});

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const ua = req.headers["user-agent"] || "";
  const url = req.originalUrl;
  trackAICrawl(url, ua);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // IMPORTANT: Register routes that return HTML first to avoid duplication
  const server = await registerRoutes(app);

  // Register SEO routes after main routes but before static/Vite
  registerSeoRoutes(app);
  
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Initialize the weekly flight price refresh scheduler
    initScheduler();
  });
})();
