import type { Book, Bookcase } from '../types/library';
import { INITIAL_BOOKCASES, INITIAL_BOOKS } from './seedData';

const STORAGE_KEY = 'rafizi_library_v1';

export interface PersistedLibrary {
  version: number;
  books: Book[];
  bookcases: Bookcase[];
}

export function loadLibrary(): PersistedLibrary {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        version: 1,
        books: INITIAL_BOOKS,
        bookcases: INITIAL_BOOKCASES,
      };
    }
    const parsed = JSON.parse(raw) as Partial<PersistedLibrary>;
    if (Array.isArray(parsed.books) && Array.isArray(parsed.bookcases) && parsed.bookcases.length > 0) {
      return {
        version: 1,
        books: parsed.books,
        bookcases: parsed.bookcases,
      };
    }
  } catch {
    // Corrupted storage falls back cleanly to seed library
  }
  return {
    version: 1,
    books: INITIAL_BOOKS,
    bookcases: INITIAL_BOOKCASES,
  };
}

export function saveLibrary(data: { books: Book[]; bookcases: Bookcase[] }): void {
  const payload: PersistedLibrary = {
    version: 1,
    books: data.books,
    bookcases: data.bookcases,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // If large base64 shelf photos exceed localStorage quota, persist metadata with URL-only photos
    try {
      const compactBookcases = data.bookcases.map((bc) => ({
        ...bc,
        photoUrl: bc.photoUrl?.startsWith('data:') ? undefined : bc.photoUrl,
      }));
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, books: data.books, bookcases: compactBookcases })
      );
    } catch {
      // Ignore quota errors silently if storage is disabled
    }
  }
}

/**
 * Downscales an image DataURL/File to max 1400px width JPEG for fast Gemini analysis and storage.
 */
export async function compressImageToDataUrl(
  source: File | Blob | string,
  maxWidth = 1400,
  quality = 0.84
): Promise<{ dataUrl: string; mimeType: string }> {
  const img = new Image();
  img.crossOrigin = 'anonymous';

  const objectUrl =
    typeof source === 'string' ? source : URL.createObjectURL(source);

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Görsel yüklenemedi.'));
      img.src = objectUrl;
    });

    const scale = img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1;
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Görsel işleme bağlamı oluşturulamadı.');
    }
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return { dataUrl, mimeType: 'image/jpeg' };
  } finally {
    if (typeof source !== 'string') {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
