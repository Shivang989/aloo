import { getSetting, setSetting } from "../../database/saved-settings";
import { sendAnimation, sendAnimationBuffer } from "../../telegram/messages";

const FLOWER_GIF_SETTING_KEY = "market_flower_bloom_gif_v1";
let cachedGifBuffer: Buffer | null = null;
let cachedTelegramFileId: string | null = null;

function lzwEncode(indices: Uint8Array, minCodeSize: number): Buffer {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;

  const dictionary = new Map<string, number>();
  const resetDict = () => {
    dictionary.clear();
    for (let i = 0; i < clearCode; i++) {
      dictionary.set(String(i), i);
    }
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  };

  resetDict();

  const bytes: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;

  const pushCode = (code: number) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      bytes.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  pushCode(clearCode);

  let prefix = String(indices[0]);
  for (let i = 1; i < indices.length; i++) {
    const k = String(indices[i]);
    const combined = `${prefix},${k}`;
    if (dictionary.has(combined)) {
      prefix = combined;
    } else {
      pushCode(dictionary.get(prefix)!);
      if (nextCode < 4096) {
        dictionary.set(combined, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) {
          codeSize++;
        }
      } else {
        pushCode(clearCode);
        resetDict();
      }
      prefix = k;
    }
  }

  pushCode(dictionary.get(prefix)!);
  pushCode(eoiCode);
  if (bitCount > 0) {
    bytes.push(bitBuffer & 0xff);
  }

  const subBlocks: Buffer[] = [];
  for (let offset = 0; offset < bytes.length; offset += 255) {
    const slice = bytes.slice(offset, offset + 255);
    subBlocks.push(Buffer.from([slice.length, ...slice]));
  }
  subBlocks.push(Buffer.from([0x00]));
  return Buffer.concat(subBlocks);
}

function buildFlowerFrame(stage: number, width: number, height: number): Uint8Array {
  const pixels = new Uint8Array(width * height); // 0 = dark background
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2) - 4;

  const setPx = (x: number, y: number, color: number) => {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      pixels[y * width + x] = color;
    }
  };

  const fillCircle = (ox: number, oy: number, r: number, color: number) => {
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r2) {
          setPx(ox + dx, oy + dy, color);
        }
      }
    }
  };

  // Stem & leaves (emerald green = 1)
  const stemTop = stage === 0 ? cy + 8 : cy + 2;
  for (let y = stemTop; y < height - 3; y++) {
    setPx(cx - 1, y, 1);
    setPx(cx, y, 1);
  }
  // Left & right leaves
  fillCircle(cx - 5, cy + 12, 3, 1);
  fillCircle(cx + 5, cy + 10, 3, 1);

  if (stage === 0) {
    // Small green/mint bud
    fillCircle(cx, cy + 7, 3, 6);
  } else if (stage === 1) {
    // Closed pink bud
    fillCircle(cx, cy + 1, 5, 3);
    fillCircle(cx, cy, 3, 2);
  } else if (stage === 2) {
    // Half-open 4-petal flower
    const offset = 5;
    fillCircle(cx, cy - offset, 4, 2);
    fillCircle(cx, cy + offset, 4, 2);
    fillCircle(cx - offset, cy, 4, 2);
    fillCircle(cx + offset, cy, 4, 2);
    fillCircle(cx, cy, 3, 4);
  } else {
    // Full 8-petal blooming flower + golden center + sparkles
    const cardinal = 7;
    const diag = 5;
    fillCircle(cx, cy - cardinal, 4, 3);
    fillCircle(cx, cy + cardinal, 4, 3);
    fillCircle(cx - cardinal, cy, 4, 3);
    fillCircle(cx + cardinal, cy, 4, 3);

    fillCircle(cx - diag, cy - diag, 4, 2);
    fillCircle(cx + diag, cy - diag, 4, 2);
    fillCircle(cx - diag, cy + diag, 4, 2);
    fillCircle(cx + diag, cy + diag, 4, 2);

    // Golden center & bright highlight
    fillCircle(cx, cy, 4, 4);
    fillCircle(cx - 1, cy - 1, 2, 5);

    // Sparkles around bloom
    setPx(cx - 13, cy - 11, 7);
    setPx(cx + 13, cy - 10, 5);
    setPx(cx + 12, cy + 11, 7);
    setPx(cx - 12, cy + 9, 5);
  }

  return pixels;
}

export function getFlowerBloomGifBuffer(): Buffer {
  if (cachedGifBuffer) return cachedGifBuffer;

  const width = 48;
  const height = 48;

  // 8-color palette (3 bits)
  const palette = Buffer.from([
    0x14, 0x19, 0x23, // 0: background
    0x2e, 0xcc, 0x71, // 1: leaf green
    0xff, 0x6b, 0x9d, // 2: soft pink petal
    0xff, 0x2e, 0x7e, // 3: deep rose petal
    0xff, 0xd1, 0x66, // 4: gold center
    0xff, 0xf3, 0xb0, // 5: light gold highlight
    0xa8, 0xe6, 0xcf, // 6: mint bud
    0xff, 0xff, 0xff, // 7: white sparkle
  ]);

  const header = Buffer.from("GIF89a", "ascii");
  const lsd = Buffer.from([
    width & 0xff,
    (width >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff,
    0xf2, // Global Color Table, 8 entries
    0x00,
    0x00,
  ]);

  const netscapeLoop = Buffer.concat([
    Buffer.from([0x21, 0xff, 0x0b]),
    Buffer.from("NETSCAPE2.0", "ascii"),
    Buffer.from([0x03, 0x01, 0x00, 0x00, 0x00]),
  ]);

  const delays = [25, 25, 30, 65];
  const frames: Buffer[] = [];

  for (let stage = 0; stage < 4; stage++) {
    const delay = delays[stage];
    const gce = Buffer.from([
      0x21,
      0xf9,
      0x04,
      0x04,
      delay & 0xff,
      (delay >> 8) & 0xff,
      0x00,
      0x00,
    ]);
    const imageDesc = Buffer.from([
      0x2c,
      0x00,
      0x00,
      0x00,
      0x00,
      width & 0xff,
      (width >> 8) & 0xff,
      height & 0xff,
      (height >> 8) & 0xff,
      0x00,
    ]);
    const minCodeSize = 3;
    const pixels = buildFlowerFrame(stage, width, height);
    const lzwData = lzwEncode(pixels, minCodeSize);
    frames.push(gce, imageDesc, Buffer.from([minCodeSize]), lzwData);
  }

  cachedGifBuffer = Buffer.concat([
    header,
    lsd,
    palette,
    netscapeLoop,
    ...frames,
    Buffer.from([0x3b]),
  ]);
  return cachedGifBuffer;
}

export async function sendFlowerAnimatedMenu(
  botToken: string,
  chatId: number,
  caption: string,
  replyMarkup: Record<string, any>
): Promise<boolean> {
  try {
    if (!cachedTelegramFileId) {
      const stored = await getSetting<string>(FLOWER_GIF_SETTING_KEY);
      if (stored && typeof stored === "string") {
        cachedTelegramFileId = stored;
      }
    }

    if (cachedTelegramFileId) {
      const cachedRes = await sendAnimation(
        botToken,
        chatId,
        cachedTelegramFileId,
        caption,
        replyMarkup
      );
      if (cachedRes.ok) {
        return true;
      }
      cachedTelegramFileId = null;
    }

    const gifBuf = getFlowerBloomGifBuffer();
    const uploadRes = await sendAnimationBuffer(
      botToken,
      chatId,
      gifBuf,
      "flower-bloom.gif",
      caption,
      replyMarkup
    );

    if (uploadRes.ok) {
      const fileId =
        uploadRes.result?.animation?.file_id || uploadRes.result?.document?.file_id;
      if (fileId) {
        cachedTelegramFileId = fileId;
        await setSetting(FLOWER_GIF_SETTING_KEY, fileId).catch(() => {});
      }
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
