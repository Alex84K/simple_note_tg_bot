function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Не задана переменная окружения ${name}. Скопируй .env.example в .env и заполни.`);
  }
  return value;
}

export const config = {
  botToken: required("BOT_TOKEN"),
  dbPath: process.env.DB_PATH ?? "./data/notes.db",
  filesDir: process.env.FILES_DIR ?? "./data/files",
};
