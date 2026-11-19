import { processBroadcastBatch } from "../features/broadcast/delivery-worker";

let workerRunning = false;
let workerActive = false;
let wakeSignal = false;

export function wakeBroadcastWorker(): void {
  wakeSignal = true;
}

export function stopBroadcastWorker(): void {
  workerRunning = false;
}

export function startBroadcastWorker(botToken: string): void {
  if (workerRunning) return;
  workerRunning = true;

  const loop = async () => {
    while (workerRunning) {
      wakeSignal = false;
      if (!workerActive) {
        workerActive = true;
        try {
          let keepDraining = true;
          while (keepDraining && workerRunning) {
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
        }
      }

      // Sleep up to 2000ms unless woken immediately by a new campaign launch/resume
      for (let i = 0; i < 20; i++) {
        if (!workerRunning || wakeSignal) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  };

  void loop();
}
