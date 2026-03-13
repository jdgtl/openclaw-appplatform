import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GatewayClient } from "./gateway.js";
import { GatewayWS } from "./gateway-ws.js";
import { attachBrowserWS } from "./browser-ws.js";
import { MockGatewayClient } from "./mock-gateway.js";
import { statusRouter } from "./routes/status.js";
import { sessionsRouter } from "./routes/sessions.js";
import { cronRouter } from "./routes/cron.js";
import { systemRouter } from "./routes/system.js";
import { configRouter } from "./routes/config.js";
import { workspaceRouter } from "./routes/workspace.js";
import { skillsRouter } from "./routes/skills.js";
import { usageRouter } from "./routes/usage.js";
import { tasksRouter } from "./routes/tasks.js";
import { openaiUsageRouter } from "./routes/openai-usage.js";

const port = parseInt(process.env.MC_PORT || "3333", 10);
const gatewayPort = process.env.GATEWAY_PORT || "18789";
const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || "";
const useMock = process.env.MOCK === "true";

if (useMock) {
  console.log("[mission-control] MOCK mode — using in-memory mock gateway");
} else if (!gatewayToken) {
  console.warn("[mission-control] WARNING: OPENCLAW_GATEWAY_TOKEN not set — gateway calls will fail");
}

const gatewayBaseUrl = `http://127.0.0.1:${gatewayPort}`;

// HTTP client for tool invocations (status, sessions, cron, system)
const gateway: GatewayClient = useMock
  ? (new MockGatewayClient() as unknown as GatewayClient)
  : new GatewayClient(gatewayBaseUrl, gatewayToken);

// WebSocket client for chat streaming
const gatewayWs = new GatewayWS(
  `ws://127.0.0.1:${gatewayPort}`,
  gatewayToken,
);

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// API routes
app.use("/api/status", statusRouter(gateway));
app.use("/api/sessions", sessionsRouter(gateway));
app.use("/api/cron", cronRouter(gateway));
app.use("/api/system", systemRouter(gateway));
app.use("/api/config", configRouter(gateway));
app.use("/api/workspace", workspaceRouter());
app.use("/api/skills", skillsRouter(gatewayWs));
app.use("/api/usage", usageRouter());
app.use("/api/tasks", tasksRouter());
app.use("/api/openai/usage", openaiUsageRouter());

// Static files (frontend build output)
const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(__dirname, "..", "..", "frontend", "dist");
app.use(express.static(frontendDir));

// SPA fallback — serve index.html for all non-API routes
// Express 5 requires named wildcard params
app.get("/{*path}", (_req, res) => {
  res.sendFile(join(frontendDir, "index.html"));
});

const server = app.listen(port, async () => {
  console.log(`[mission-control] Listening on http://127.0.0.1:${port}`);
  console.log(`[mission-control] Gateway: ${useMock ? "MOCK" : gatewayBaseUrl}`);

  // Connect WS to gateway (skip in mock mode)
  if (!useMock) {
    try {
      await gatewayWs.connect();
    } catch (err) {
      console.warn(
        "[mission-control] Gateway WS initial connect failed:",
        (err as Error).message,
        "— will retry",
      );
    }
  }
});

// Browser WebSocket — multiplexes chat onto the gateway WS connection
attachBrowserWS(server, gatewayWs);
