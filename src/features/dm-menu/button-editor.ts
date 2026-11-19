import { SimpleButton } from "./types";

export function parseButtonRows(raw: string): {
  rows: SimpleButton[][];
  alerts: Record<string, string>;
} {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: SimpleButton[][] = [];
  const alerts: Record<string, string> = {};

  for (const line of lines) {
    const segments = line
      .split("&&")
      .map((s) => s.trim())
      .filter(Boolean);
    const row: SimpleButton[] = [];

    for (const seg of segments) {
      const splitIdx = seg.indexOf("-");
      if (splitIdx === -1) continue;

      const title = seg.slice(0, splitIdx).trim();
      let target = seg.slice(splitIdx + 1).trim();
      if (!title || !target) continue;

      if (/^(alert|popup):/i.test(target)) {
        const alertMsg = target.replace(/^(alert|popup):\s*/i, "").trim();
        const alertKey = `alt_${Math.random().toString(36).slice(2, 8)}`;
        alerts[alertKey] = alertMsg;
        row.push({ text: title, type: "alert", value: alertKey });
      } else if (/^share:/i.test(target)) {
        const shareMsg = target.replace(/^share:\s*/i, "").trim();
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareMsg)}`;
        row.push({ text: title, type: "url", value: shareUrl });
      } else if (target.startsWith("/")) {
        row.push({ text: title, type: "cmd", value: target.toLowerCase() });
      } else {
        if (!/^https?:\/\//i.test(target) && !/^tg:\/\//i.test(target)) {
          target = `https://${target}`;
        }
        row.push({ text: title, type: "url", value: target });
      }
    }

    if (row.length > 0) rows.push(row);
  }

  return { rows, alerts };
}
