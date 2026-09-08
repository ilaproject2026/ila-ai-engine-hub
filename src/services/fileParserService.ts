import type { AttachedDocument } from './dbService';

/**
 * Formats bytes to human-readable file size (KB, MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Reads a single File object and extracts textual content and metadata.
 */
export async function parseFileToDocument(file: File): Promise<AttachedDocument> {
  const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const name = file.name;
  const size = file.size;
  const type = file.type || 'text/plain';

  return new Promise((resolve) => {
    // For images, read as Data URL for preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id,
          name,
          size,
          type,
          content: `[Image Document: ${name} (${formatFileSize(size)})]`,
          dataUrl: reader.result as string,
          uploadedAt: Date.now(),
        });
      };
      reader.onerror = () => {
        resolve({
          id,
          name,
          size,
          type,
          content: `[Image Document: ${name}]`,
          uploadedAt: Date.now(),
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    // For text-based documents (txt, md, json, csv, code, etc.)
    const textReader = new FileReader();
    textReader.onload = () => {
      let textContent = (textReader.result as string) || '';
      
      // If it's a binary PDF / Word document without native client parser, provide clean summary
      if (file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        // Attempt basic text extraction from string representation if clean
        const printableChars = textContent.replace(/[^\x20-\x7E\t\n\r]/g, ' ');
        const cleaned = printableChars.replace(/\s+/g, ' ').trim();
        if (cleaned.length > 50) {
          textContent = `[Parsed Content from ${name}]:\n${cleaned.substring(0, 15000)}`;
        } else {
          textContent = `[Document: ${name} (${formatFileSize(size)}) attached as course reference material]`;
        }
      }

      resolve({
        id,
        name,
        size,
        type,
        content: textContent,
        uploadedAt: Date.now(),
      });
    };

    textReader.onerror = () => {
      resolve({
        id,
        name,
        size,
        type,
        content: `[Document ${name} uploaded]`,
        uploadedAt: Date.now(),
      });
    };

    textReader.readAsText(file);
  });
}

/**
 * Parses multiple files concurrently.
 */
export async function parseMultipleFiles(files: FileList | File[]): Promise<AttachedDocument[]> {
  const fileArray = Array.from(files);
  const parsePromises = fileArray.map((file) => parseFileToDocument(file));
  return Promise.all(parsePromises);
}
