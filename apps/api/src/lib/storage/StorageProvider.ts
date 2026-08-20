/**
 * Abstraction over where uploaded files (resumes today) actually live.
 * The rest of the app only ever deals with an opaque `storageKey` string
 * returned by `save` — never a filesystem path or bucket URL directly —
 * so swapping the local-disk implementation for an S3-compatible one in
 * production (see .env.example STORAGE_* vars) requires no caller changes.
 */
export interface StorageProvider {
  readonly name: string;

  /** Persists `buffer` and returns an opaque key that can later be passed to `read`/`delete`. */
  save(key: string, buffer: Buffer): Promise<string>;

  read(storageKey: string): Promise<Buffer>;

  delete(storageKey: string): Promise<void>;
}
