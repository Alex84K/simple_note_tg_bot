const HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;
const URL_RE = /https?:\/\/[^\s]+/i;

/** Извлекает теги (#tag) из текста. */
export function extractTags(text: string): string[] {
  const tags = new Set<string>();
  for (const m of text.matchAll(HASHTAG_RE)) {
    if (m[1]) tags.add(m[1]);
  }
  return [...tags];
}

/** true, если текст целиком является ссылкой (с возможными тегами/пробелами вокруг). */
export function isLink(text: string): boolean {
  const withoutTags = text.replace(HASHTAG_RE, "").trim();
  return URL_RE.test(withoutTags) && withoutTags.split(/\s+/).length === 1;
}
