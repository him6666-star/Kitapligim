import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookPlus,
  Camera,
  Check,
  Loader2,
  ScanBarcode,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type {
  Book,
  Bookcase,
  DetectedShelfBook,
  ReadingStatus,
  ShelfRegion,
} from '../types/library';
import { BOOK_CATEGORIES } from '../types/library';
import {
  cleanIsbn,
  findDuplicateBook,
  getNextPositionInShelf,
  inferShelfRegion,
} from '../lib/libraryUtils';
import { SAMPLE_STUDY_PHOTO } from '../lib/seedData';
import { compressImageToDataUrl } from '../lib/storage';

export type ScannerMode = 'raf-fotografi' | 'barkod' | 'manuel';

interface ScannerModalProps {
  open: boolean;
  initialMode: ScannerMode;
  initialBookcaseId?: string;
  bookcases: Bookcase[];
  existingBooks: Book[];
  onClose: () => void;
  onAddBooksBatch: (
    newBooks: Array<Omit<Book, 'id' | 'addedAt'>>,
    shelfPhotoUpdate?: { bookcaseId: string; photoUrl: string }
  ) => void;
}

const SPINE_PRESETS = [
  '#244033',
  '#1E3A5F',
  '#6B2D38',
  '#374151',
  '#8A4F24',
  '#274C5E',
  '#B47B38',
  '#DDD6CB',
];

export function ScannerModal({
  open,
  initialMode,
  initialBookcaseId,
  bookcases,
  existingBooks,
  onClose,
  onAddBooksBatch,
}: ScannerModalProps) {
  const [mode, setMode] = useState<ScannerMode>(initialMode);
  const defaultBookcaseId = initialBookcaseId || bookcases[0]?.id || 'bc-salon';

  // --- Shared target bookcase state ---
  const [targetBookcaseId, setTargetBookcaseId] = useState<string>(defaultBookcaseId);

  // --- Mode 1: Shelf Photo Scan State ---
  const [startingShelf, setStartingShelf] = useState<number>(1);
  const [shelfPreviewUrl, setShelfPreviewUrl] = useState<string | null>(null);
  const [shelfCameraActive, setShelfCameraActive] = useState(false);
  const [shelfScanning, setShelfScanning] = useState(false);
  const [shelfError, setShelfError] = useState('');
  const [shelfNotes, setShelfNotes] = useState('');
  const [detectedBooks, setDetectedBooks] = useState<DetectedShelfBook[]>([]);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const shelfVideoRef = useRef<HTMLVideoElement | null>(null);
  const shelfStreamRef = useRef<MediaStream | null>(null);

  // --- Mode 2: Barcode (ISBN) Scanner State ---
  const [isbnInput, setIsbnInput] = useState('');
  const [barcodeCameraActive, setBarcodeCameraActive] = useState(false);
  const [isbnLoading, setIsbnLoading] = useState(false);
  const [isbnError, setIsbnError] = useState('');
  const [isbnSourceNote, setIsbnSourceNote] = useState('');
  const [isbnResult, setIsbnResult] = useState<{
    isbn: string;
    title: string;
    author: string;
    publisher: string;
    category: string;
    pageCount: string;
    publishYear: string;
    description: string;
    shelfRow: number;
    positionInShelf: number;
    readingStatus: ReadingStatus;
  } | null>(null);
  const barcodeVideoRef = useRef<HTMLVideoElement | null>(null);
  const barcodeControlsRef = useRef<{ stop: () => void } | null>(null);

  // --- Mode 3: Manual Entry State ---
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthor, setManualAuthor] = useState('');
  const [manualPublisher, setManualPublisher] = useState('');
  const [manualCategory, setManualCategory] = useState<string>('Roman');
  const [manualIsbn, setManualIsbn] = useState('');
  const [manualPageCount, setManualPageCount] = useState('');
  const [manualShelfRow, setManualShelfRow] = useState(1);
  const [manualPosition, setManualPosition] = useState(1);
  const [manualRegion, setManualRegion] = useState<ShelfRegion>('Orta');
  const [manualStatus, setManualStatus] = useState<ReadingStatus>('okunacak');
  const [manualSpineColor, setManualSpineColor] = useState(SPINE_PRESETS[0]);
  const [manualError, setManualError] = useState('');

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      const bcId = initialBookcaseId || bookcases[0]?.id || 'bc-salon';
      setTargetBookcaseId(bcId);
      setManualPosition(getNextPositionInShelf(existingBooks, bcId, 1));
    } else {
      stopAllCameras();
    }
    return () => {
      stopAllCameras();
    };
  }, [open, initialMode, initialBookcaseId]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  function stopAllCameras() {
    if (shelfStreamRef.current) {
      shelfStreamRef.current.getTracks().forEach((t) => t.stop());
      shelfStreamRef.current = null;
    }
    setShelfCameraActive(false);

    if (barcodeControlsRef.current) {
      try {
        barcodeControlsRef.current.stop();
      } catch {
        // ignore stop errors
      }
      barcodeControlsRef.current = null;
    }
    setBarcodeCameraActive(false);
  }

  function handleModeSwitch(nextMode: ScannerMode) {
    stopAllCameras();
    setMode(nextMode);
  }

  // ============== MODE 1: SHELF PHOTO SCAN ==============
  async function startShelfCamera() {
    setShelfError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setShelfError(
          'Tarayıcınız canlı kamera erişimini desteklemiyor. Fotoğraf yükleme seçeneğini kullanabilirsiniz.'
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 } },
        audio: false,
      });
      shelfStreamRef.current = stream;
      setShelfCameraActive(true);
      requestAnimationFrame(() => {
        if (shelfVideoRef.current) {
          shelfVideoRef.current.srcObject = stream;
          shelfVideoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setShelfError(
        'Kamera izni alınamadı veya cihazda kamera bulunamadı. Bilgisayarınızdan/telefonunuzdan raf fotoğrafı yükleyebilirsiniz.'
      );
    }
  }

  async function captureShelfFromCamera() {
    const video = shelfVideoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    stopAllCameras();
    await analyzeShelfImage(dataUrl, 'image/jpeg');
  }

  async function handleShelfFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setShelfError('');
    try {
      const compressed = await compressImageToDataUrl(file, 1400, 0.84);
      await analyzeShelfImage(compressed.dataUrl, compressed.mimeType);
    } catch {
      setShelfError('Seçilen fotoğraf okunamadı. Lütfen geçerli bir görsel dosyası seçin.');
    } finally {
      e.target.value = '';
    }
  }

  async function handleTrySampleShelfPhoto() {
    setShelfError('');
    try {
      const compressed = await compressImageToDataUrl(SAMPLE_STUDY_PHOTO, 1400, 0.86);
      await analyzeShelfImage(compressed.dataUrl, compressed.mimeType);
    } catch {
      setShelfError('Örnek kitaplık fotoğrafı yüklenemedi.');
    }
  }

  async function analyzeShelfImage(dataUrl: string, mimeType: string) {
    setShelfPreviewUrl(dataUrl);
    setShelfScanning(true);
    setShelfError('');
    setDetectedBooks([]);
    setShelfNotes('');

    const bookcase = bookcases.find((bc) => bc.id === targetBookcaseId);

    try {
      const res = await fetch('/api/scan-shelf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType,
          bookcaseName: bookcase?.name ?? 'Kitaplığım',
          startingShelf,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Raf fotoğrafı analiz edilemedi.');
      }

      const items: DetectedShelfBook[] = Array.isArray(payload.books) ? payload.books : [];
      setDetectedBooks(items);
      setShelfNotes(payload.notes || '');
      if (items.length === 0) {
        setShelfError(
          'Fotoğrafta net okunabilen kitap sırtı tespit edilemedi. Daha aydınlık ve dik açıdan çekilmiş bir fotoğraf deneyin.'
        );
      }
    } catch (err) {
      setShelfError(
        err instanceof Error ? err.message : 'Fotoğraf analizi sırasında bir hata oluştu.'
      );
    } finally {
      setShelfScanning(false);
    }
  }

  function updateDetectedField(
    tempId: string,
    patch: Partial<DetectedShelfBook>
  ) {
    setDetectedBooks((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, ...patch } : item))
    );
  }

  function handleSaveDetectedBooks() {
    const selected = detectedBooks.filter((b) => b.selected && b.title.trim());
    if (selected.length === 0) {
      setShelfError('Kaydetmek için en az bir kitap seçin.');
      return;
    }

    const mapped: Array<Omit<Book, 'id' | 'addedAt'>> = selected.map((item) => ({
      title: item.title.trim(),
      author: item.author.trim() || 'Bilinmiyor',
      publisher: item.publisher.trim() || 'Bilinmiyor',
      category: item.category || 'Diğer',
      bookcaseId: targetBookcaseId,
      shelfRow: Math.max(1, item.shelfRow),
      positionInShelf: Math.max(1, item.positionInShelf),
      positionRegion: item.positionRegion,
      spineColor: item.spineColor || '#334155',
      box2d: item.box2d,
      readingStatus: 'okunacak',
      currentPage: 0,
      source: 'raf-fotografi',
    }));

    onAddBooksBatch(
      mapped,
      shelfPreviewUrl ? { bookcaseId: targetBookcaseId, photoUrl: shelfPreviewUrl } : undefined
    );
    setDetectedBooks([]);
    setShelfPreviewUrl(null);
    onClose();
  }

  // ============== MODE 2: BARCODE (ISBN) SCAN ==============
  async function startBarcodeCamera() {
    setIsbnError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setIsbnError(
          'Canlı barkod tarayıcı bu tarayıcıda desteklenmiyor. Barkod fotoğrafı yükleyebilir veya ISBN numarasını yazabilirsiniz.'
        );
        return;
      }
      setBarcodeCameraActive(true);
      const reader = new BrowserMultiFormatReader();
      requestAnimationFrame(async () => {
        if (!barcodeVideoRef.current) return;
        try {
          const controls = await reader.decodeFromVideoDevice(
            undefined,
            barcodeVideoRef.current,
            (result) => {
              if (result) {
                const code = cleanIsbn(result.getText());
                if (code.length === 10 || code.length === 13) {
                  controls.stop();
                  barcodeControlsRef.current = null;
                  setBarcodeCameraActive(false);
                  setIsbnInput(code);
                  void lookupIsbn(code);
                }
              }
            }
          );
          barcodeControlsRef.current = controls;
        } catch {
          setBarcodeCameraActive(false);
          setIsbnError(
            'Kamera başlatılamadı. Barkod fotoğrafı yükleyebilir veya ISBN numarasını elle girebilirsiniz.'
          );
        }
      });
    } catch {
      setBarcodeCameraActive(false);
      setIsbnError('Kamera erişimi sağlanamadı.');
    }
  }

  async function handleBarcodeImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsbnError('');
    const objectUrl = URL.createObjectURL(file);
    try {
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(objectUrl);
      const code = cleanIsbn(result.getText());
      setIsbnInput(code);
      await lookupIsbn(code);
    } catch {
      setIsbnError(
        'Görselde net bir ISBN barkodu okunamadı. Barkodu yakından çekin veya numarayı aşağıya yazın.'
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
      e.target.value = '';
    }
  }

  async function lookupIsbn(rawCode?: string) {
    const code = cleanIsbn(rawCode ?? isbnInput);
    if (code.length !== 10 && code.length !== 13) {
      setIsbnError('Lütfen 10 veya 13 haneli geçerli bir ISBN barkod numarası girin.');
      return;
    }

    setIsbnLoading(true);
    setIsbnError('');
    setIsbnSourceNote('');
    setIsbnResult(null);

    try {
      const res = await fetch('/api/lookup-isbn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isbn: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ISBN sorgulanamadı.');
      }

      const nextPos = getNextPositionInShelf(existingBooks, targetBookcaseId, 1);

      if (data.found && data.book) {
        setIsbnSourceNote(`Kaynak: ${data.source}`);
        setIsbnResult({
          isbn: data.book.isbn || code,
          title: data.book.title || '',
          author: data.book.author || '',
          publisher: data.book.publisher || '',
          category: data.book.category || 'Roman',
          pageCount: data.book.pageCount ? String(data.book.pageCount) : '',
          publishYear: data.book.publishYear ? String(data.book.publishYear) : '',
          description: data.book.description || '',
          shelfRow: 1,
          positionInShelf: nextPos,
          readingStatus: 'okunacak',
        });
      } else {
        setIsbnError(data.message || 'ISBN katalogda bulunamadı.');
        setIsbnResult({
          isbn: code,
          title: '',
          author: '',
          publisher: '',
          category: 'Roman',
          pageCount: '',
          publishYear: '',
          description: '',
          shelfRow: 1,
          positionInShelf: nextPos,
          readingStatus: 'okunacak',
        });
      }
    } catch (err) {
      setIsbnError(err instanceof Error ? err.message : 'ISBN sorgulama hatası.');
    } finally {
      setIsbnLoading(false);
    }
  }

  function handleSaveIsbnBook(e: React.FormEvent) {
    e.preventDefault();
    if (!isbnResult) return;
    if (!isbnResult.title.trim() || !isbnResult.author.trim()) {
      setIsbnError('Kitap adı ve yazar alanları zorunludur.');
      return;
    }

    const sameShelfCount =
      existingBooks.filter(
        (b) => b.bookcaseId === targetBookcaseId && b.shelfRow === isbnResult.shelfRow
      ).length + 1;

    onAddBooksBatch([
      {
        title: isbnResult.title.trim(),
        author: isbnResult.author.trim(),
        publisher: isbnResult.publisher.trim() || 'Bilinmiyor',
        category: isbnResult.category || 'Diğer',
        isbn: isbnResult.isbn,
        pageCount: isbnResult.pageCount ? Number(isbnResult.pageCount) : undefined,
        publishYear: isbnResult.publishYear ? Number(isbnResult.publishYear) : undefined,
        description: isbnResult.description || undefined,
        bookcaseId: targetBookcaseId,
        shelfRow: Math.max(1, isbnResult.shelfRow),
        positionInShelf: Math.max(1, isbnResult.positionInShelf),
        positionRegion: inferShelfRegion(isbnResult.positionInShelf, sameShelfCount),
        spineColor: SPINE_PRESETS[Math.floor(Math.random() * SPINE_PRESETS.length)],
        readingStatus: isbnResult.readingStatus,
        currentPage:
          isbnResult.readingStatus === 'okundu' && isbnResult.pageCount
            ? Number(isbnResult.pageCount)
            : 0,
        source: 'barkod',
      },
    ]);

    setIsbnResult(null);
    setIsbnInput('');
    onClose();
  }

  // ============== MODE 3: MANUAL ENTRY ==============
  function handleSaveManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualTitle.trim()) {
      setManualError('Lütfen kitap adını girin.');
      return;
    }
    if (!manualAuthor.trim()) {
      setManualError('Lütfen yazar adını girin.');
      return;
    }
    setManualError('');

    const pagesNum = manualPageCount ? Number(manualPageCount) : undefined;
    onAddBooksBatch([
      {
        title: manualTitle.trim(),
        author: manualAuthor.trim(),
        publisher: manualPublisher.trim() || 'Bilinmiyor',
        category: manualCategory,
        isbn: manualIsbn.trim() ? cleanIsbn(manualIsbn) : undefined,
        pageCount: pagesNum && pagesNum > 0 ? pagesNum : undefined,
        bookcaseId: targetBookcaseId,
        shelfRow: Math.max(1, manualShelfRow),
        positionInShelf: Math.max(1, manualPosition),
        positionRegion: manualRegion,
        spineColor: manualSpineColor,
        readingStatus: manualStatus,
        currentPage: manualStatus === 'okundu' && pagesNum ? pagesNum : 0,
        source: 'manuel',
      },
    ]);

    setManualTitle('');
    setManualAuthor('');
    setManualPublisher('');
    setManualIsbn('');
    setManualPageCount('');
    onClose();
  }

  if (!open) return null;

  const selectedDetectedCount = detectedBooks.filter((b) => b.selected).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-zinc-950/50 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-modal-title"
        className="w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl border border-zinc-200 flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-zinc-200 flex items-center justify-between gap-4">
          <div>
            <h2 id="scanner-modal-title" className="font-editorial text-xl font-medium text-zinc-950">
              Kitaplığa Ekle &amp; Tara
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Tüm rafın fotoğrafını tek seferde tarayın, barkod okutun veya elle kayıt ekleyin.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tarama penceresini kapat"
            className="p-2 text-zinc-500 hover:text-zinc-900 rounded-lg"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-5 sm:px-6 pt-3 border-b border-zinc-200 bg-zinc-50/70 flex items-center gap-2 overflow-x-auto">
          {(
            [
              { id: 'raf-fotografi', label: 'Raf Fotoğrafı (Toplu)', icon: Camera },
              { id: 'barkod', label: 'Barkod (ISBN) Okut', icon: ScanBarcode },
              { id: 'manuel', label: 'Manuel Ekle', icon: BookPlus },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleModeSwitch(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-emerald-900 text-zinc-950'
                    : 'border-transparent text-zinc-600 hover:text-zinc-950'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {/* ============== TAB 1: RAF FOTOĞRAFI (AI SHELF SCAN) ============== */}
          {mode === 'raf-fotografi' && (
            <div className="space-y-5">
              {/* Target Bookcase & Starting Shelf */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                <div className="sm:col-span-2">
                  <label htmlFor="scan-target-bc" className="block text-xs font-medium text-zinc-700 mb-1">
                    Hangi Kitaplığa Kaydedilsin?
                  </label>
                  <select
                    id="scan-target-bc"
                    value={targetBookcaseId}
                    onChange={(e) => setTargetBookcaseId(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-lg text-sm"
                  >
                    {bookcases.map((bc) => (
                      <option key={bc.id} value={bc.id}>
                        {bc.name} ({bc.room})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="scan-start-shelf" className="block text-xs font-medium text-zinc-700 mb-1">
                    Fotoğraftaki İlk Raf No
                  </label>
                  <input
                    id="scan-start-shelf"
                    type="number"
                    min={1}
                    max={12}
                    value={startingShelf}
                    onChange={(e) => setStartingShelf(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums"
                  />
                </div>
              </div>

              {/* Camera Capture / File Upload / Sample Try */}
              {!shelfCameraActive && !shelfScanning && detectedBooks.length === 0 && (
                <div className="border-2 border-dashed border-zinc-300 rounded-xl p-6 sm:p-8 text-center space-y-4 bg-zinc-50/40">
                  <div className="max-w-lg mx-auto">
                    <h3 className="font-editorial text-lg font-medium text-zinc-950">
                      Kitaplığınızın fotoğrafını çekin, tüm rafları tek seferde tanıyalım
                    </h3>
                    <p className="mt-1.5 text-sm text-zinc-600">
                      Kitap sırtları net görünecek şekilde karşıdan çekim yapın. Sistem her kitabın
                      adını, yazarını, yayınevini, kategorisini ve raftaki sırasını otomatik çıkarır.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={startShelfCamera}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Camera className="w-4 h-4" aria-hidden="true" />
                      <span>Kamerayı Aç</span>
                    </button>

                    <label className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-800 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
                      <Upload className="w-4 h-4" aria-hidden="true" />
                      <span>Fotoğraf Yükle</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleShelfFileChange}
                        className="sr-only"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleTrySampleShelfPhoto}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-950 bg-emerald-900/10 hover:bg-emerald-900/15 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                      <span>Örnek Kitaplık Fotoğrafıyla Dene</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Live Camera Preview */}
              {shelfCameraActive && (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-zinc-950 aspect-video">
                    <video
                      ref={shelfVideoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={captureShelfFromCamera}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg"
                    >
                      <Camera className="w-4 h-4" aria-hidden="true" />
                      <span>Fotoğrafı Çek ve Tara</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopAllCameras}
                      className="px-4 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
                    >
                      Kamerayı Kapat
                    </button>
                  </div>
                </div>
              )}

              {/* Scanning Loading State */}
              {shelfScanning && (
                <div className="border border-zinc-200 rounded-xl p-8 text-center space-y-3 bg-zinc-50">
                  <Loader2 className="w-7 h-7 animate-spin text-emerald-900 mx-auto" aria-hidden="true" />
                  <div className="font-medium text-sm text-zinc-900">
                    Kitap sırtları ve raf konumları analiz ediliyor...
                  </div>
                  <p className="text-xs text-zinc-500">
                    Raf sırası, kitap adları, yazarlar ve yayınevleri tespit ediliyor.
                  </p>
                </div>
              )}

              {/* Error Message */}
              {shelfError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-900"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" aria-hidden="true" />
                  <span>{shelfError}</span>
                </div>
              )}

              {/* Interactive Review Studio after Detection */}
              {!shelfScanning && detectedBooks.length > 0 && shelfPreviewUrl && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-sm text-zinc-950">
                        <span className="font-mono tabular-nums">{detectedBooks.length}</span> kitap
                        tespit edildi — kaydetmeden önce düzenleyebilirsiniz
                      </h3>
                      {shelfNotes && <p className="text-xs text-zinc-500 mt-0.5">{shelfNotes}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDetectedBooks([]);
                        setShelfPreviewUrl(null);
                        setShelfError('');
                      }}
                      className="text-xs font-medium text-zinc-600 hover:text-zinc-950 underline underline-offset-2"
                    >
                      Başka Fotoğraf Seç
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-4 items-start">
                    {/* Annotated Photo with Bounding Box Pins */}
                    <div className="relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-950">
                      <img
                        src={shelfPreviewUrl}
                        alt="Taranan kitaplık fotoğrafı"
                        className="w-full h-auto block"
                      />
                      <div className="absolute inset-0">
                        {detectedBooks.map((item, index) => {
                          if (!item.box2d) return null;
                          const [ymin, xmin, ymax, xmax] = item.box2d;
                          const isPinned = activePinId === item.tempId;
                          return (
                            <button
                              key={item.tempId}
                              type="button"
                              onClick={() => setActivePinId(item.tempId)}
                              aria-label={`${index + 1}. kitap: ${item.title}`}
                              style={{
                                top: `${ymin / 10}%`,
                                left: `${xmin / 10}%`,
                                height: `${Math.max(4, (ymax - ymin) / 10)}%`,
                                width: `${Math.max(2.5, (xmax - xmin) / 10)}%`,
                              }}
                              className={`absolute rounded-[2px] transition-all ${
                                !item.selected
                                  ? 'border border-zinc-400/40 bg-black/40'
                                  : isPinned
                                  ? 'border-2 border-amber-400 bg-amber-400/25 z-20'
                                  : 'border border-emerald-400/80 bg-emerald-500/15 hover:bg-emerald-500/25 z-10'
                              }`}
                            >
                              <span className="absolute -top-2 -left-1 px-1 py-0.5 text-[9px] font-mono font-semibold bg-zinc-950/90 text-white rounded leading-none">
                                {index + 1}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Editable Checklist of Detected Books */}
                    <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-200 max-h-[420px] overflow-y-auto">
                      {detectedBooks.map((item, idx) => {
                        const duplicate = findDuplicateBook(
                          { title: item.title, author: item.author },
                          existingBooks
                        );
                        const isPinned = activePinId === item.tempId;
                        return (
                          <div
                            key={item.tempId}
                            onMouseEnter={() => setActivePinId(item.tempId)}
                            className={`p-3 space-y-2 transition-colors ${
                              isPinned ? 'bg-amber-50/70' : 'bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={item.selected}
                                  onChange={(e) =>
                                    updateDetectedField(item.tempId, {
                                      selected: e.target.checked,
                                    })
                                  }
                                  className="rounded border-zinc-300 text-emerald-900 focus:ring-emerald-800"
                                />
                                <span className="font-mono text-zinc-500">#{idx + 1}</span>
                                <span className="font-mono text-emerald-900">
                                  {item.shelfRow}. Raf · Sıra {item.positionInShelf} ({item.positionRegion})
                                </span>
                              </label>
                              {duplicate && (
                                <span className="text-[11px] font-medium text-amber-800">
                                  Katalogda var
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={item.title}
                                aria-label={`Kitap ${idx + 1} adı`}
                                onChange={(e) =>
                                  updateDetectedField(item.tempId, { title: e.target.value })
                                }
                                placeholder="Kitap adı"
                                className="col-span-2 h-8 px-2.5 text-xs font-medium bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:border-emerald-800"
                              />
                              <input
                                type="text"
                                value={item.author}
                                aria-label={`Kitap ${idx + 1} yazarı`}
                                onChange={(e) =>
                                  updateDetectedField(item.tempId, { author: e.target.value })
                                }
                                placeholder="Yazar"
                                className="h-8 px-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:border-emerald-800"
                              />
                              <input
                                type="text"
                                value={item.publisher}
                                aria-label={`Kitap ${idx + 1} yayınevi`}
                                onChange={(e) =>
                                  updateDetectedField(item.tempId, { publisher: e.target.value })
                                }
                                placeholder="Yayınevi"
                                className="h-8 px-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:border-emerald-800"
                              />
                              <select
                                value={item.category}
                                aria-label={`Kitap ${idx + 1} kategorisi`}
                                onChange={(e) =>
                                  updateDetectedField(item.tempId, { category: e.target.value })
                                }
                                className="h-8 px-2 text-xs bg-zinc-50 border border-zinc-200 rounded-md"
                              >
                                {BOOK_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  value={item.shelfRow}
                                  aria-label={`Kitap ${idx + 1} raf no`}
                                  onChange={(e) =>
                                    updateDetectedField(item.tempId, {
                                      shelfRow: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                  className="w-1/2 h-8 px-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-md"
                                  title="Raf numarası"
                                />
                                <input
                                  type="number"
                                  min={1}
                                  value={item.positionInShelf}
                                  aria-label={`Kitap ${idx + 1} sıra no`}
                                  onChange={(e) =>
                                    updateDetectedField(item.tempId, {
                                      positionInShelf: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                  className="w-1/2 h-8 px-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-md"
                                  title="Soldan sıra"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-200 flex items-center justify-between gap-3">
                    <span className="text-xs text-zinc-500 tabular-nums">
                      Seçili: <strong className="text-zinc-900">{selectedDetectedCount}</strong> /{' '}
                      {detectedBooks.length} kitap
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveDetectedBooks}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Check className="w-4 h-4" aria-hidden="true" />
                      <span>Seçilenleri Kitaplığa Ekle ({selectedDetectedCount})</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============== TAB 2: BARKOD (ISBN) SCANNER ============== */}
          {mode === 'barkod' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Camera / Photo Barcode Decode */}
                <div className="border border-zinc-200 rounded-xl p-4 space-y-3 bg-zinc-50/60">
                  <div className="text-sm font-medium text-zinc-950">
                    Kamera ile Arka Kapak Barkodu Okut
                  </div>
                  <p className="text-xs text-zinc-600">
                    Kitabın arkasındaki EAN-13 / ISBN barkodunu kameraya tutun veya barkod fotoğrafı
                    yükleyin.
                  </p>

                  {barcodeCameraActive ? (
                    <div className="space-y-2.5">
                      <div className="relative rounded-lg overflow-hidden bg-zinc-950 aspect-video">
                        <video
                          ref={barcodeVideoRef}
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                        <div
                          aria-hidden="true"
                          className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-16 border-2 border-amber-400/90 rounded-md pointer-events-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={stopAllCameras}
                        className="w-full py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg"
                      >
                        Kamerayı Durdur
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={startBarcodeCamera}
                        className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg whitespace-nowrap"
                      >
                        <ScanBarcode className="w-4 h-4" aria-hidden="true" />
                        <span>Barkod Kamerasını Aç</span>
                      </button>

                      <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-zinc-800 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg cursor-pointer whitespace-nowrap">
                        <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Barkod Fotoğrafı Yükle</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleBarcodeImageUpload}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Manual ISBN Lookup Input */}
                <div className="border border-zinc-200 rounded-xl p-4 space-y-3 bg-zinc-50/60">
                  <label htmlFor="isbn-lookup-input" className="block text-sm font-medium text-zinc-950">
                    ISBN Numarası ile Sorgula
                  </label>
                  <p className="text-xs text-zinc-600">
                    Barkodun altındaki 13 haneli numarayı yazıp kitap adı, yazar ve yayınevini
                    otomatik getirin.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void lookupIsbn();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      id="isbn-lookup-input"
                      type="text"
                      value={isbnInput}
                      onChange={(e) => setIsbnInput(e.target.value)}
                      placeholder="Örn. 9789754700114"
                      className="flex-1 h-10 px-3 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums focus:outline-none focus:border-emerald-800"
                    />
                    <button
                      type="submit"
                      disabled={isbnLoading}
                      className="h-10 px-4 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 rounded-lg whitespace-nowrap shrink-0"
                    >
                      {isbnLoading ? 'Aranıyor...' : 'Sorgula'}
                    </button>
                  </form>
                </div>
              </div>

              {isbnError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-950"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
                  <span>{isbnError}</span>
                </div>
              )}

              {isbnResult && (
                <form
                  onSubmit={handleSaveIsbnBook}
                  className="border border-zinc-200 rounded-xl p-5 space-y-4 bg-white"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                    <div>
                      <h3 className="font-medium text-sm text-zinc-950">
                        ISBN Kaydı: <span className="font-mono">{isbnResult.isbn}</span>
                      </h3>
                      {isbnSourceNote && (
                        <p className="text-xs text-emerald-800 mt-0.5">{isbnSourceNote}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label htmlFor="isbn-title" className="block text-xs font-medium text-zinc-700 mb-1">
                        Kitap Adı *
                      </label>
                      <input
                        id="isbn-title"
                        type="text"
                        value={isbnResult.title}
                        onChange={(e) => setIsbnResult({ ...isbnResult, title: e.target.value })}
                        className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="isbn-author" className="block text-xs font-medium text-zinc-700 mb-1">
                        Yazar *
                      </label>
                      <input
                        id="isbn-author"
                        type="text"
                        value={isbnResult.author}
                        onChange={(e) => setIsbnResult({ ...isbnResult, author: e.target.value })}
                        className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="isbn-publisher" className="block text-xs font-medium text-zinc-700 mb-1">
                        Yayınevi
                      </label>
                      <input
                        id="isbn-publisher"
                        type="text"
                        value={isbnResult.publisher}
                        onChange={(e) =>
                          setIsbnResult({ ...isbnResult, publisher: e.target.value })
                        }
                        className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="isbn-category" className="block text-xs font-medium text-zinc-700 mb-1">
                        Kategori
                      </label>
                      <select
                        id="isbn-category"
                        value={isbnResult.category}
                        onChange={(e) =>
                          setIsbnResult({ ...isbnResult, category: e.target.value })
                        }
                        className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm"
                      >
                        {BOOK_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="isbn-pages" className="block text-xs font-medium text-zinc-700 mb-1">
                        Sayfa Sayısı
                      </label>
                      <input
                        id="isbn-pages"
                        type="number"
                        min={1}
                        value={isbnResult.pageCount}
                        onChange={(e) =>
                          setIsbnResult({ ...isbnResult, pageCount: e.target.value })
                        }
                        className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm font-mono"
                      />
                    </div>

                    <div>
                      <label htmlFor="isbn-bc" className="block text-xs font-medium text-zinc-700 mb-1">
                        Kitaplık
                      </label>
                      <select
                        id="isbn-bc"
                        value={targetBookcaseId}
                        onChange={(e) => setTargetBookcaseId(e.target.value)}
                        className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm"
                      >
                        {bookcases.map((bc) => (
                          <option key={bc.id} value={bc.id}>
                            {bc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="isbn-shelf" className="block text-xs font-medium text-zinc-700 mb-1">
                          Raf No
                        </label>
                        <input
                          id="isbn-shelf"
                          type="number"
                          min={1}
                          value={isbnResult.shelfRow}
                          onChange={(e) =>
                            setIsbnResult({
                              ...isbnResult,
                              shelfRow: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label htmlFor="isbn-pos" className="block text-xs font-medium text-zinc-700 mb-1">
                          Sıra No
                        </label>
                        <input
                          id="isbn-pos"
                          type="number"
                          min={1}
                          value={isbnResult.positionInShelf}
                          onChange={(e) =>
                            setIsbnResult({
                              ...isbnResult,
                              positionInShelf: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg"
                    >
                      <Check className="w-4 h-4" aria-hidden="true" />
                      <span>Kitaplığa Kaydet</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ============== TAB 3: MANUAL ENTRY ============== */}
          {mode === 'manuel' && (
            <form onSubmit={handleSaveManual} className="space-y-4 max-w-2xl" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="manual-title" className="block text-xs font-medium text-zinc-700 mb-1">
                    Kitap Adı *
                  </label>
                  <input
                    id="manual-title"
                    type="text"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="Örn. Beyaz Gemi"
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-emerald-800"
                  />
                </div>

                <div>
                  <label htmlFor="manual-author" className="block text-xs font-medium text-zinc-700 mb-1">
                    Yazar *
                  </label>
                  <input
                    id="manual-author"
                    type="text"
                    value={manualAuthor}
                    onChange={(e) => setManualAuthor(e.target.value)}
                    placeholder="Örn. Cengiz Aytmatov"
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-emerald-800"
                  />
                </div>

                <div>
                  <label htmlFor="manual-publisher" className="block text-xs font-medium text-zinc-700 mb-1">
                    Yayınevi
                  </label>
                  <input
                    id="manual-publisher"
                    type="text"
                    value={manualPublisher}
                    onChange={(e) => setManualPublisher(e.target.value)}
                    placeholder="Örn. Ötüken Neşriyat"
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-emerald-800"
                  />
                </div>

                <div>
                  <label htmlFor="manual-category" className="block text-xs font-medium text-zinc-700 mb-1">
                    Kategori
                  </label>
                  <select
                    id="manual-category"
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm"
                  >
                    {BOOK_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="manual-isbn" className="block text-xs font-medium text-zinc-700 mb-1">
                    ISBN (İsteğe bağlı)
                  </label>
                  <input
                    id="manual-isbn"
                    type="text"
                    value={manualIsbn}
                    onChange={(e) => setManualIsbn(e.target.value)}
                    placeholder="978..."
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="manual-pages" className="block text-xs font-medium text-zinc-700 mb-1">
                    Sayfa Sayısı
                  </label>
                  <input
                    id="manual-pages"
                    type="number"
                    min={1}
                    value={manualPageCount}
                    onChange={(e) => setManualPageCount(e.target.value)}
                    placeholder="220"
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="manual-status" className="block text-xs font-medium text-zinc-700 mb-1">
                    Okuma Durumu
                  </label>
                  <select
                    id="manual-status"
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value as ReadingStatus)}
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm"
                  >
                    <option value="okunacak">Okunacak</option>
                    <option value="okunuyor">Okunuyor</option>
                    <option value="okundu">Okundu</option>
                  </select>
                </div>
              </div>

              {/* Shelf Placement */}
              <div className="pt-3 border-t border-zinc-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="manual-bc" className="block text-xs font-medium text-zinc-700 mb-1">
                    Kitaplık
                  </label>
                  <select
                    id="manual-bc"
                    value={targetBookcaseId}
                    onChange={(e) => setTargetBookcaseId(e.target.value)}
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm"
                  >
                    {bookcases.map((bc) => (
                      <option key={bc.id} value={bc.id}>
                        {bc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="manual-shelf-row" className="block text-xs font-medium text-zinc-700 mb-1">
                    Raf No
                  </label>
                  <input
                    id="manual-shelf-row"
                    type="number"
                    min={1}
                    max={12}
                    value={manualShelfRow}
                    onChange={(e) => setManualShelfRow(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="manual-position" className="block text-xs font-medium text-zinc-700 mb-1">
                    Soldan Sıra
                  </label>
                  <input
                    id="manual-position"
                    type="number"
                    min={1}
                    value={manualPosition}
                    onChange={(e) => setManualPosition(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label htmlFor="manual-region" className="block text-xs font-medium text-zinc-700 mb-1">
                    Raf Bölgesi
                  </label>
                  <select
                    id="manual-region"
                    value={manualRegion}
                    onChange={(e) => setManualRegion(e.target.value as ShelfRegion)}
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm"
                  >
                    <option value="Sol">Sol</option>
                    <option value="Orta">Orta</option>
                    <option value="Sağ">Sağ</option>
                  </select>
                </div>

                <div>
                  <span className="block text-xs font-medium text-zinc-700 mb-1.5">
                    Sırt Rengi
                  </span>
                  <div className="flex items-center gap-2">
                    {SPINE_PRESETS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setManualSpineColor(hex)}
                        aria-label={`Sırt rengi ${hex}`}
                        style={{ backgroundColor: hex }}
                        className={`w-6 h-6 rounded-md border ${
                          manualSpineColor === hex
                            ? 'ring-2 ring-offset-2 ring-emerald-900 border-zinc-400'
                            : 'border-zinc-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {manualError && (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {manualError}
                </p>
              )}

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg transition-colors"
                >
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>Kitabı Kaydet</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-950"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
