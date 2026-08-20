import multer from "multer";
import path from "node:path";
import { SUPPORTED_RESUME_MIME_TYPES } from "../modules/resume/parsers/textExtraction.js";

/** Resumes only — keeps parsing bounded and avoids storing arbitrary large files. */
export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx"]);

/**
 * Validates both MIME type and file extension before anything touches
 * disk — the two checks are independent because a MIME type is
 * client-supplied and easy to spoof, so extension is a second, cheap
 * signal, not a replacement.
 */
export const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk = (SUPPORTED_RESUME_MIME_TYPES as readonly string[]).includes(file.mimetype);
    const extOk = ALLOWED_EXTENSIONS.has(ext);

    if (!mimeOk || !extOk) {
      callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "file"));
      return;
    }
    callback(null, true);
  },
});
