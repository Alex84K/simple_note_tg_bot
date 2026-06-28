import { mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import type { Bot } from "grammy";
import { config } from "../config.ts";

mkdirSync(config.filesDir, { recursive: true });

/**
 * Скачивает файл Telegram (по file_id) на локальный диск и возвращает путь.
 * Имя файла строится из tg user id + file_unique_id, чтобы получить дедупликацию
 * (повторная отправка того же файла перезапишет идентичный файл, без дублей).
 */
export async function downloadFile(
  bot: Bot,
  tgUserId: number,
  fileId: string,
): Promise<string> {
  const file = await bot.api.getFile(fileId);
  if (!file.file_path) {
    throw new Error("Telegram не вернул file_path для файла");
  }

  const url = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Не удалось скачать файл: HTTP ${res.status}`);
  }

  const ext = extname(file.file_path);
  const name = `${tgUserId}_${file.file_unique_id}${ext}`;
  const dest = join(config.filesDir, name);

  await Bun.write(dest, res);
  return dest;
}
