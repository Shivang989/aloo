import { SimpleButton } from "./types";
import { BOT_SETTINGS } from "../../settings/bot-settings";

export function getDefaultButtons(): SimpleButton[][] {
  return [
    [{ text: "📖 Help", type: "cmd", value: "/help" }],
    [
      {
        text: "📢 Updates",
        type: "alert",
        value: "Updates will be posted here as new features launch!",
      },
      {
        text: "💬 Feedback",
        type: "alert",
        value: "Have suggestions? Message us directly!",
      },
    ],
    [
      {
        text: "➕ Add Me to Your Group",
        type: "url",
        value: `https://t.me/${BOT_SETTINGS.BOT_USERNAME}?startgroup=true`,
      },
    ],
  ];
}

export function compileInlineKeyboard(rows: SimpleButton[][]): { inline_keyboard: any[][] } {
  const inline_keyboard = rows.map((row) =>
    row.map((btn) => {
      if (btn.type === "url") {
        return { text: btn.text, url: btn.value };
      }
      if (btn.type === "cmd") {
        return { text: btn.text, callback_data: `dm_cmd:${btn.value}` };
      }
      if (btn.type === "alert") {
        return { text: btn.text, callback_data: `dm_alt:${btn.value.slice(0, 40)}` };
      }
      return { text: btn.text, callback_data: "dm_none" };
    })
  );
  return { inline_keyboard };
}
