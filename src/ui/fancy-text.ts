const UPPER_MAP: Record<string, string> = {
  A: "𝙰", B: "𝙱", C: "𝙲", D: "𝙳", E: "𝙴", F: "𝙵", G: "𝙶", H: "𝙷", I: "𝙸",
  J: "𝙹", K: "𝙺", L: "𝙻", M: "𝙼", N: "𝙽", O: "𝙾", P: "𝙿", Q: "𝚀", R: "𝚁",
  S: "𝚂", T: "𝚃", U: "𝚄", V: "𝚅", W: "𝚆", X: "𝚇", Y: "𝚈", Z: "𝚉",
};

const LOWER_MAP: Record<string, string> = {
  a: "α", b: "ᑲ", c: "𝖼", d: "ᑯ", e: "𝖾", f: "𝖿", g: "𝗀", h: "ɦ", i: "𝗂",
  j: "𝗃", k: "𝗄", l: "ᥣ", m: "ꭑ", n: "𐓣", o: "ⱺ", p: "ρ", q: "𝗊", r: "𝗋",
  s: "𝗌", t: "𝗍", u: "υ", v: "𝗏", w: "ω", x: "𝗑", y: "𝗒", z: "ƶ",
};

const SANS_BOLD_MAP: Record<string, string> = {
  A: "𝗔", B: "𝗕", C: "𝗖", D: "𝗗", E: "𝗘", F: "𝗙", G: "𝗚", H: "𝗛", I: "𝗜", J: "𝗝",
  K: "𝗞", L: "𝗟", M: "𝗠", N: "𝗡", O: "𝗢", P: "𝗣", Q: "𝗤", R: "𝗥", S: "𝗦", T: "𝗧",
  U: "𝗨", V: "𝗩", W: "𝗪", X: "𝗫", Y: "𝗬", Z: "𝗭",
  a: "𝗮", b: "𝗯", c: "𝗰", d: "𝗱", e: "𝗲", f: "𝗳", g: "𝗴", h: "𝗵", i: "𝗶", j: "𝗷",
  k: "𝗸", l: "𝗹", m: "𝗺", n: "𝗻", o: "𝗼", p: "𝗽", q: "𝗾", r: "𝗿", s: "𝘀", t: "𝘁",
  u: "𝘂", v: "𝘃", w: "𝘄", x: "𝘅", y: "𝘆", z: "𝘇",
  0: "𝟬", 1: "𝟭", 2: "𝟮", 3: "𝟯", 4: "𝟰", 5: "𝟱", 6: "𝟲", 7: "𝟳", 8: "𝟴", 9: "𝟵",
};

export function toCustomFont(text: string): string {
  let result = "";
  let insideTag = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "<") {
      insideTag = true;
      result += char;
      continue;
    }
    if (insideTag) {
      result += char;
      if (char === ">") insideTag = false;
      continue;
    }
    result += UPPER_MAP[char] || LOWER_MAP[char] || char;
  }

  return result;
}

export function toFancy(text: string): string {
  return text
    .split("")
    .map((c) => SANS_BOLD_MAP[c] || c)
    .join("");
}

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
