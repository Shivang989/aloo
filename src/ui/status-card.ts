import { toCustomFont } from "./fancy-text";

export interface StatusCardRow {
  label: string;
  value: string | number;
}

export interface StatusCardOptions {
  title: string;
  rows: StatusCardRow[];
  footer?: string;
}

export function createStatusCard(options: StatusCardOptions): string {
  const titleText = toCustomFont(options.title);
  const rowsText = options.rows
    .map((row) => `• <b>${toCustomFont(row.label)}:</b> ${row.value}`)
    .join("\n");

  let card = `<b>${titleText}</b>\n\n<blockquote>${rowsText}</blockquote>`;

  if (options.footer) {
    card += `\n\n<i>${toCustomFont(options.footer)}</i>`;
  }

  return card;
}
