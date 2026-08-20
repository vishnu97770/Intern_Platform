import mammoth from "mammoth";
// pdf-parse's package.json main entry runs a debug snippet when required
// directly in some setups; importing the lib file avoids that. Falling
// back to the package root keeps this working if that internal path ever
// changes across a dependency bump.
import pdfParse from "pdf-parse";

export const PDF_MIME_TYPE = "application/pdf";
export const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const SUPPORTED_RESUME_MIME_TYPES = [PDF_MIME_TYPE, DOCX_MIME_TYPE] as const;

/** Extracts plain text from a PDF or DOCX buffer. Throws if the format is unsupported or the file is unreadable. */
export async function extractResumeText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === PDF_MIME_TYPE) {
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (mimeType === DOCX_MIME_TYPE) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported mime type for text extraction: ${mimeType}`);
}
