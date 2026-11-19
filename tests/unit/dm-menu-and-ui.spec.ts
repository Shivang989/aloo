import { describe, it, expect } from "vitest";
import { parseButtonRows } from "../../src/features/dm-menu/button-editor";
import { compileInlineKeyboard } from "../../src/features/dm-menu/button-layout";
import { renderCustomTemplate } from "../../src/features/dm-menu/template-renderer";
import { toCustomFont, escapeHtml } from "../../src/ui/fancy-text";
import { createStatusCard } from "../../src/ui/status-card";

describe("DM Menu Builder & UI Formatting", () => {
  it("parses full-width, half-width, command, and alert buttons", () => {
    const raw = [
      "Help - /help",
      "Site - example.com && Alert - alert: Hello World",
    ].join("\n");

    const { rows, alerts } = parseButtonRows(raw);
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toEqual({ text: "Help", type: "cmd", value: "/help" });
    expect(rows[1][0]).toEqual({ text: "Site", type: "url", value: "https://example.com" });
    expect(rows[1][1].type).toBe("alert");
    expect(Object.values(alerts)).toContain("Hello World");

    const compiled = compileInlineKeyboard(rows);
    expect(compiled.inline_keyboard[0][0].callback_data).toBe("dm_cmd:/help");
    expect(compiled.inline_keyboard[1][0].url).toBe("https://example.com");
  });

  it("renders custom templates safely with HTML escaping", () => {
    const rendered = renderCustomTemplate("{b}Hi {first_name}{/b} — ₹{balance} ({kills})", {
      id: 12345,
      first_name: "<Admin>",
      balance: 2500,
      kills: 7,
    });
    expect(rendered).toBe("<b>Hi &lt;Admin&gt;</b> — ₹2500 (7)");
  });

  it("preserves HTML tags when applying custom typography", () => {
    const styled = toCustomFont("<b>Hello</b>");
    expect(styled.startsWith("<b>")).toBe(true);
    expect(styled.endsWith("</b>")).toBe(true);
    expect(escapeHtml("A & B")).toBe("A &amp; B");

    const card = createStatusCard({
      title: "TEST",
      rows: [{ label: "CASH", value: "₹100" }],
      footer: "DONE",
    });
    expect(card).toContain("<blockquote>");
  });
});
