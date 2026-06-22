import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type MediaObjectVisibility = "public" | "private";
export type MediaObjectStorageBackend = "local_fs" | "local_private_fs" | "private_audio_fs";

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

export type ReadMediaObjectInput = {
  visibility: MediaObjectVisibility;
  storagePath: string;
};

export type DeleteMediaObjectInput = {
  visibility: MediaObjectVisibility;
  storagePath: string;
};

export type MediaObjectStore = {
  write(input: WriteMediaObjectInput): Promise<StoredMediaObject>;
  read(input: ReadMediaObjectInput): Promise<Buffer>;
  delete(input: DeleteMediaObjectInput): Promise<void>;
};

export type LocalMediaObjectStoreOptions = {
  publicRoot: string;
  privateRoot: string;
  publicStorageBackend?: MediaObjectStorageBackend;
  privateStorageBackend?: MediaObjectStorageBackend;
};

function publicUrlForVisibility(visibility: MediaObjectVisibility, storagePath: string): string | null {
  return visibility === "public" ? `/${storagePath}` : null;
}

export class LocalMediaObjectStore implements MediaObjectStore {
  constructor(private readonly options: LocalMediaObjectStoreOptions) {}

  private rootForVisibility(visibility: MediaObjectVisibility): string {
    return visibility === "public" ? this.options.publicRoot : this.options.privateRoot;
  }

  private storageBackendForVisibility(visibility: MediaObjectVisibility): MediaObjectStorageBackend {
    return visibility === "public"
      ? this.options.publicStorageBackend ?? "local_fs"
      : this.options.privateStorageBackend ?? "local_private_fs";
  }

  private absolutePathFor(visibility: MediaObjectVisibility, storagePath: string): string {
    const root = path.resolve(this.rootForVisibility(visibility));
    const absolutePath = path.resolve(root, ...storagePath.split("/"));
    if (!absolutePath.startsWith(root + path.sep) && absolutePath !== root) {
      throw new Error("media_object_path_escape");
    }
    return absolutePath;
  }

  async write(input: WriteMediaObjectInput): Promise<StoredMediaObject> {
    const absolutePath = this.absolutePathFor(input.visibility, input.storagePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return {
      storageBackend: this.storageBackendForVisibility(input.visibility),
      storagePath: input.storagePath,
      publicUrl: publicUrlForVisibility(input.visibility, input.storagePath),
    };
  }

  async read(input: ReadMediaObjectInput): Promise<Buffer> {
    return readFile(this.absolutePathFor(input.visibility, input.storagePath));
  }

  async delete(input: DeleteMediaObjectInput): Promise<void> {
    try {
      await unlink(this.absolutePathFor(input.visibility, input.storagePath));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export function createLegacyMediaObjectStore(options: LocalMediaObjectStoreOptions): MediaObjectStore {
  return new LocalMediaObjectStore(options);
}
