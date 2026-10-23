import { access, lstat, mkdir, readFile, realpath, unlink, writeFile } from "node:fs/promises";
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

export type ReferenceMediaObjectInput = {
  visibility: MediaObjectVisibility;
  storagePath: string;
};

export type ExistsMediaObjectInput = ReferenceMediaObjectInput;
export type DeleteMediaObjectInput = ReferenceMediaObjectInput;

export type MediaObjectStore = {
  write(input: WriteMediaObjectInput): Promise<StoredMediaObject>;
  read(input: ReadMediaObjectInput): Promise<Buffer>;
  reference(input: ReferenceMediaObjectInput): StoredMediaObject;
  exists(input: ExistsMediaObjectInput): Promise<boolean>;
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

  reference(input: ReferenceMediaObjectInput): StoredMediaObject {
    this.absolutePathFor(input.visibility, input.storagePath);
    return {
      storageBackend: this.storageBackendForVisibility(input.visibility),
      storagePath: input.storagePath,
      publicUrl: publicUrlForVisibility(input.visibility, input.storagePath),
    };
  }

  private async checkedAbsolutePath(visibility: MediaObjectVisibility, storagePath: string): Promise<string> {
    const absolutePath = this.absolutePathFor(visibility, storagePath);
    const root = await realpath(path.resolve(this.rootForVisibility(visibility)));
    try {
      if ((await lstat(absolutePath)).isSymbolicLink()) {
        throw new Error("media_object_path_escape");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    let resolvedPath: string;
    try {
      resolvedPath = await realpath(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // For a new leaf, resolve the existing parent so an in-root symlink
      // cannot redirect writes or make a private read escape its root.
      const resolvedParent = await realpath(path.dirname(absolutePath));
      resolvedPath = path.join(resolvedParent, path.basename(absolutePath));
    }
    if (!resolvedPath.startsWith(root + path.sep) && resolvedPath !== root) {
      throw new Error("media_object_path_escape");
    }
    return absolutePath;
  }

  private async ensureSafeParentDirectory(visibility: MediaObjectVisibility, storagePath: string): Promise<void> {
    const absolutePath = this.absolutePathFor(visibility, storagePath);
    const rootPath = path.resolve(this.rootForVisibility(visibility));
    await mkdir(rootPath, { recursive: true });
    const canonicalRoot = await realpath(rootPath);
    const relativeParent = path.relative(rootPath, path.dirname(absolutePath));
    let currentPath = rootPath;
    for (const segment of relativeParent.split(path.sep).filter(Boolean)) {
      currentPath = path.join(currentPath, segment);
      try {
        const entry = await lstat(currentPath);
        if (entry.isSymbolicLink() || !entry.isDirectory()) {
          throw new Error("media_object_path_escape");
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        try {
          await mkdir(currentPath);
        } catch (mkdirError) {
          if ((mkdirError as NodeJS.ErrnoException).code !== "EEXIST") throw mkdirError;
          // Another writer may have created this directory after our lstat.
          // Revalidate it so a symlink race cannot turn the retry into traversal.
          const racedEntry = await lstat(currentPath);
          if (racedEntry.isSymbolicLink() || !racedEntry.isDirectory()) {
            throw new Error("media_object_path_escape");
          }
        }
      }
      const canonicalCurrent = await realpath(currentPath);
      if (!canonicalCurrent.startsWith(canonicalRoot + path.sep) && canonicalCurrent !== canonicalRoot) {
        throw new Error("media_object_path_escape");
      }
    }
  }

  async write(input: WriteMediaObjectInput): Promise<StoredMediaObject> {
    const absolutePath = this.absolutePathFor(input.visibility, input.storagePath);
    await this.ensureSafeParentDirectory(input.visibility, input.storagePath);
    await this.checkedAbsolutePath(input.visibility, input.storagePath);
    await writeFile(absolutePath, input.buffer);
    return this.reference(input);
  }

  async read(input: ReadMediaObjectInput): Promise<Buffer> {
    return readFile(await this.checkedAbsolutePath(input.visibility, input.storagePath));
  }

  async exists(input: ExistsMediaObjectInput): Promise<boolean> {
    try {
      await access(await this.checkedAbsolutePath(input.visibility, input.storagePath));
      return true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return false;
      throw error;
    }
  }

  async delete(input: DeleteMediaObjectInput): Promise<void> {
    try {
      await unlink(await this.checkedAbsolutePath(input.visibility, input.storagePath));
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
