import { LocalDiskStorageProvider } from "./LocalDiskStorageProvider.js";
import type { StorageProvider } from "./StorageProvider.js";

export type { StorageProvider } from "./StorageProvider.js";

/** Single configured storage backend for the whole app. */
export const storageProvider: StorageProvider = new LocalDiskStorageProvider();
