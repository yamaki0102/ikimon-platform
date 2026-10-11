/** Path checks shared by the content projection and the filesystem-free Worker. */
export function isLearnArticlePath(path: string): boolean {
  if (!path.startsWith("/learn/") || /[?#:\\\s]/u.test(path)) return false;
  return new URL(path, "https://learn.invalid").pathname === path
    && !path.includes("//") && !path.endsWith("/");
}

export function isJapaneseLearnHtmlPath(path: string): boolean {
  return path === "/ja/learn" || (path.startsWith("/ja/") && isLearnArticlePath(path.slice(3)));
}

export function isJapaneseLearnHtmlKey(key: string): boolean {
  return key.startsWith("html/") && key.endsWith(".html")
    && isJapaneseLearnHtmlPath(`/${key.slice(5, -5)}`);
}
