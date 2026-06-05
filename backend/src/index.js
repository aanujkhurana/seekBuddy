import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import usageRoutes from "./routes/usage.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import referralRoutes from "./routes/referral.routes.js";
import crashRoutes from "./routes/crash.routes.js";
import { auth } from "./middleware/auth.js";

const app = express();
const PORT = process.env.PORT || 3000;

// CORS
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" }));

// Request logging
app.use((req, _res, next) => {
  const start = Date.now();
  req._startTime = start;
  const origEnd = _res.end;
  _res.end = function (...args) {
    const duration = Date.now() - start;
    console.log(
      `[REQ] ${req.method} ${req.originalUrl} ${_res.statusCode} ${duration}ms`
    );
    origEnd.apply(_res, args);
  };
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

app.use("/auth", authRoutes);
app.use("/ai", auth, aiRoutes);
app.use("/usage", auth, usageRoutes);
app.use("/billing", billingRoutes);
app.use("/referral", auth, referralRoutes);
app.use("/crash", auth, crashRoutes);

app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err);
  res.status(500).json({ error: "Internal server error" });
});

if (isMainModule) {
  app.listen(PORT, () => {
    console.log(`[seek-buddy-api] running on http://localhost:${PORT}`);
    console.log(`[seek-buddy-api] health: http://localhost:${PORT}/health`);
  });
}

export default app;
