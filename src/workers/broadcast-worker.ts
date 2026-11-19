import crypto from "crypto";
import { processBroadcastBatch } from "../features/broadcast/delivery-worker";
import {
  acquireWorkerLease,
  releaseWorkerLease,
  signalWorkerWake,
  consumeWorkerWake,
} from "../database/cache";

const BROADCAST_LEASE_KEY = "worker:broadcast:lease";
const BROADCAST_WAKE_KEY = "worker:broadcast:wake";
const INSTANCE_ID = `worker_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;

let workerRunning = false;
let workerActive = false;

export async function wakeBroadcastWorker(): Promise<void> {
  await signalWorkerWake(BROADCAST_WAKE_KEY);
}

export function stopBroadcastWorker(): void {
  workerRunning = false;
}

export function startBroadcastWorker(botToken: string): void {
  if (workerRunning) return;
  workerRunning = true;

  const loop = async () => {
    while (workerRunning) {
      if (!workerActive) {
        const hasLease = await acquireWorkerLease(BROADCAST_LEASE_KEY, INSTANCE_ID, 30);
        if (hasLease) {
          workerActive = true;
          try {
            let keepDraining = true;
            while (keepDraining && workerRunning) {
              // Renew lease while actively draining batches
              await acquireWorkerLease(BROADCAST_LEASE_KEY, INSTANCE_ID, 30);
              const { processed, remaining } = await processBroadcastBatch(botToken, 25);
              if (processed === 0 || remaining === 0) {
                keepDraining = false;
              } else {
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
            }
          } catch (err) {
            console.error("Broadcast worker batch error:", err);
          } finally {
            workerActive = false;
            await releaseWorkerLease(BROADCAST_LEASE_KEY, INSTANCE_ID);
          }
        }
      }

      for (let i = 0; i < 10; i++) {
        if (!workerRunning) break;
        if (await consumeWorkerWake(BROADCAST_WAKE_KEY)) break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  };

  void loop();
}
