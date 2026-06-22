import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type MediaObjectVisibility = "public" | "private";
export type MediaObjectStorageBackend = "local_fs" | "local_private_fs";

export type StoredMediaObject = {
  storageBackend: MediaObjectStorageBackend;
  storagePath: string;
  publicUrl: string | null;
};

export type WriteMediaObjectInput = {
  visibility: MediaObjectVisibility;
  storagePath: string;
  buffer: Buffer;
};

export type MediaObjectStore = {
  write(input: WriteMediaObjectInput): Promise<StoredMediaObject>;
};

export type LocalMediaObjectStoreOptions = {
  publicRoot: string;
  privateRoot: string;
};

function storageBackendForVisibility(visibility: MediaObjectVisibility): MediaObjectStorageBackend {
  return visibility === "public" ? "local_fs" : "local_private_fs";
}

function publicUrlForVisibility(visibility: MediaObjectVisibility, storagePath: string): string | null {
  return visibility === "public" ? `/${storagePath}` : null;
}

export class LocalMediaObjectStore implements MediaObjectStore {
  constructor(private readonly options: LocalMediaObjectStoreOptions) {}

  async write(input: WriteMediaObjectInput): Promise<StoredMediaObject> {
    const root = input.visibility === "public" ? this.options.publicRoot : this.options.privateRoot;
    const absolutePath = path.join(root, ...input.storagePath.split("/"));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return {
      storageBackend: storageBackendForVisibility(input.visibility),
      storagePath: input.storagePath,
      publicUrl: publicUrlForVisibility(input.visibility, input.storagePath),
    };
  }
}

export function createLegacyMediaObjectStore(options: LocalMediaObjectStoreOptions): MediaObjectStore {
  return new LocalMediaObjectStore(options);
}
