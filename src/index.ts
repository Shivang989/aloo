import http from "http";
import dotenv from "dotenv";
import { loadRuntimeEnv, RuntimeEnv } from "./types/environment";
import { initDatabases, checkDatabaseHealth, closeDatabases } from "./database/index";
import { callTelegram } from "./telegram/client";
import { TelegramUpdate } from "./telegram/types";
import { routeTelegramUpdate } from "./bot/update-router";
import { startBroadcastWorker, stopBroadcastWorker } from "./workers/broadcast-worker";

dotenv.config();

let pollingActive = true;

function startHealthServer(port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.url === "/health" || req.url === "/") {
      const dbHealth = await checkDatabaseHealth();
      const healthy = dbHealth.core && dbHealth.ops;
      res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: healthy,
          bot: "Aloo",
          databases: {
            aloo_core: dbHealth.core ? "connected" : "disconnected",
            aloo_ops: dbHealth.ops ? "connected" : "disconnected",
            redis: dbHealth.redis,
          },
          node: process.version,
        })
      );
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Not Found" }));
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Health server listening on 127.0.0.1:${port}`);
  });

  return server;
}

async function startTelegramPolling(env: RuntimeEnv): Promise<void> {
  await callTelegram(env.BOT_TOKEN, "deleteWebhook", { drop_pending_updates: false });
  console.log("Telegram long polling started.");

  let offset = 0;

  while (pollingActive) {
    try {
      const res = await callTelegram<TelegramUpdate[]>(env.BOT_TOKEN, "getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: [
          "message",
          "callback_query",
          "my_chat_member",
          "chat_member",
          "chat_join_request",
        ],
      });

      if (res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          offset = Math.max(offset, update.update_id + 1);
          routeTelegramUpdate(update, env).catch((err) => {
            console.error(`Error routing update ${update.update_id}:`, err);
          });
        }
      } else if (!res.ok) {
        console.error("getUpdates API error:", res.description);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (err) {
      console.error("Polling loop exception:", err);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

async function main(): Promise<void> {
  const env = loadRuntimeEnv();
  await initDatabases(env);
  const health = await checkDatabaseHealth();
  console.log(
    `Databases ready — aloo_core: ${health.core ? "connected" : "error"}, aloo_ops: ${
      health.ops ? "connected" : "error"
    }, redis: ${health.redis}`
  );

  const healthServer = startHealthServer(env.HEALTH_PORT);
  startBroadcastWorker(env.BOT_TOKEN);

  const shutdown = async () => {
    console.log("Shutting down Aloo Bot gracefully...");
    pollingActive = false;
    stopBroadcastWorker();
    healthServer.close();
    await closeDatabases();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await startTelegramPolling(env);
}

main().catch((err) => {
  console.error("Fatal startup failure:", err);
  process.exit(1);
});
