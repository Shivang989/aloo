import { escapeHtml } from "../../ui/fancy-text";

export function renderCustomTemplate(
  template: string,
  user: { id: number; first_name: string; balance?: number; kills?: number }
): string {
  const safeName = escapeHtml(user.first_name || "Player");
  const mention = `<a href="tg://user?id=${user.id}">${safeName}</a>`;

  return template
    .replace(/\{first_name\}/g, safeName)
    .replace(/\{mention\}/g, mention)
    .replace(/\{balance\}/g, String(user.balance ?? 0))
    .replace(/\{kills\}/g, String(user.kills ?? 0))
    .replace(/\{b\}/g, "<b>")
    .replace(/\{\/b\}/g, "</b>")
    .replace(/\{c\}/g, "<code>")
    .replace(/\{\/c\}/g, "</code>")
    .replace(/\{i\}/g, "<i>")
    .replace(/\{\/i\}/g, "</i>")
    .replace(/\{q\}/g, "<blockquote>")
    .replace(/\{\/q\}/g, "</blockquote>");
}
