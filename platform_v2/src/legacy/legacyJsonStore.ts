import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function readJsonArray<T>(filePath: string): Promise<T[]> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function readJsonObject<T extends Record<string, unknown>>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as T;
  } catch {
    return null;
  }
}

export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const json = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(tempPath, json, "utf8");
  await rename(tempPath, filePath);
}

export async function removeFileIfExists(filePath: string): Promise<void> {
  await rm(filePath, { force: true });
}

export function upsertById<T extends Record<string, unknown>>(items: T[], incoming: T, key = "id"): T[] {
  const targetId = incoming[key];
  if (typeof targetId !== "string" || targetId === "") {
    return [...items, incoming];
  }

  let updated = false;
  const nextItems = items.map((item) => {
    if (item[key] !== targetId) {
      return item;
    }

    updated = true;
    return {
      ...item,
      ...incoming,
    };
  });

  if (!updated) {
    nextItems.push(incoming);
  }

  return nextItems;
}
