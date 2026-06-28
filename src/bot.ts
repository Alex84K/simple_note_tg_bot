import { Bot } from "grammy";
import { config } from "./config.ts";
import {
  getOrCreateUser,
  createNote,
  listNotes,
  searchNotes,
  softDeleteNote,
  type Note,
} from "./db/repo.ts";
import { downloadFile } from "./storage/files.ts";
import { extractTags, isLink } from "./handlers/parse.ts";

const bot = new Bot(config.botToken);

const TYPE_ICON: Record<Note["type"], string> = {
  text: "📝",
  link: "🔗",
  image: "🖼",
  file: "📎",
};

function preview(note: Note): string {
  const icon = TYPE_ICON[note.type];
  const body =
    note.content?.replace(/\s+/g, " ").slice(0, 60) ??
    (note.file_path ? note.file_path.split("/").pop() : "") ??
    "";
  return `#${note.id} ${icon} ${body}`;
}

bot.command("start", (ctx) =>
  ctx.reply(
    "Привет! Это твоя записная книжка.\n\n" +
      "Просто пришли текст, ссылку, фото или файл — я сохраню.\n" +
      "Добавляй #теги прямо в сообщение.\n\n" +
      "Команды:\n" +
      "/list — последние заметки\n" +
      "/search <текст> — поиск\n" +
      "/del <id> — удалить заметку",
  ),
);

bot.command("list", (ctx) => {
  const userId = getOrCreateUser(ctx.from!.id);
  const notes = listNotes(userId);
  if (notes.length === 0) return ctx.reply("Пока пусто. Пришли что-нибудь!");
  return ctx.reply(notes.map(preview).join("\n"));
});

bot.command("search", (ctx) => {
  const query = ctx.match.trim();
  if (!query) return ctx.reply("Использование: /search <текст>");
  const userId = getOrCreateUser(ctx.from!.id);
  const notes = searchNotes(userId, query);
  if (notes.length === 0) return ctx.reply("Ничего не найдено.");
  return ctx.reply(notes.map(preview).join("\n"));
});

bot.command("del", (ctx) => {
  const id = Number(ctx.match.trim());
  if (!Number.isInteger(id)) return ctx.reply("Использование: /del <id>");
  const userId = getOrCreateUser(ctx.from!.id);
  const ok = softDeleteNote(userId, id);
  return ctx.reply(ok ? `Удалено #${id}` : `Заметка #${id} не найдена.`);
});

// Текст и ссылки
bot.on("message:text", (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return; // необработанная команда — игнорируем
  const userId = getOrCreateUser(ctx.from.id);
  const tags = extractTags(text);
  const type = isLink(text) ? "link" : "text";
  const id = createNote({ userId, type, content: text, tags });
  return ctx.reply(`Сохранено ${TYPE_ICON[type]} #${id}`);
});

// Фото
bot.on("message:photo", async (ctx) => {
  const userId = getOrCreateUser(ctx.from.id);
  const photo = ctx.message.photo.at(-1)!; // максимальное разрешение
  const caption = ctx.message.caption ?? null;
  const tags = caption ? extractTags(caption) : [];
  const path = await downloadFile(bot, ctx.from.id, photo.file_id);
  const id = createNote({ userId, type: "image", content: caption, filePath: path, tags });
  return ctx.reply(`Сохранено 🖼 #${id}`);
});

// Документы / файлы
bot.on("message:document", async (ctx) => {
  const userId = getOrCreateUser(ctx.from.id);
  const doc = ctx.message.document;
  const caption = ctx.message.caption ?? doc.file_name ?? null;
  const tags = ctx.message.caption ? extractTags(ctx.message.caption) : [];
  const path = await downloadFile(bot, ctx.from.id, doc.file_id);
  const id = createNote({ userId, type: "file", content: caption, filePath: path, tags });
  return ctx.reply(`Сохранено 📎 #${id}`);
});

bot.catch((err) => {
  console.error("Ошибка в обработчике:", err.error);
  err.ctx.reply("Упс, что-то пошло не так при сохранении.").catch(() => {});
});

await bot.api.setMyCommands([
  { command: "list", description: "Последние заметки" },
  { command: "search", description: "Поиск по заметкам" },
  { command: "del", description: "Удалить заметку по id" },
]);

console.log("Бот запущен.");
bot.start();
