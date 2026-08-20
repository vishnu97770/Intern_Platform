import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import type { StorageProvider } from "./StorageProvider.js";

const root = path.resolve(process.cwd(), env.UPLOAD_DIR);

/** Rejects any key that could escape the upload root (e.g. via `..` segments). */
function resolveSafe(key: string): string {
  const resolved = path.resolve(root, key);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Refusing to resolve storage key outside upload root: ${key}`);
  }
  return resolved;
}

/**
 * Default StorageProvider for local development and single-instance
 * deployments: writes under UPLOAD_DIR on local disk. Swap for an
 * S3-compatible provider in production by implementing StorageProvider
 * and wiring it up in ./index.ts.
 */
export class LocalDiskStorageProvider implements StorageProvider {
  readonly name = "local-disk";

  async save(key: string, buffer: Buffer): Promise<string> {
    const filePath = resolveSafe(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
    return key;
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(resolveSafe(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await rm(resolveSafe(storageKey), { force: true });
  }
}
