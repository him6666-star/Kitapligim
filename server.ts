import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY yapılandırılmamış.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function cleanIsbnInput(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase();
}

function extractErrorMessage(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('GEMINI_API_KEY')) {
    return {
      status: 503,
      message:
        'Gemini API anahtarı bulunamadı. Lütfen Settings > Secrets panelinden API anahtarınızı kontrol edin.',
    };
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message:
        'API anahtarı yetkisi doğrulanamadı. Lütfen Settings > Secrets panelinden anahtarınızı kontrol edin.',
    };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'API istek kotası aşıldı. Kısa bir süre sonra tekrar deneyin.',
    };
  }
  return {
    status: 500,
    message: 'İşlem sırasında bir sunucu hatası oluştu: ' + raw.slice(0, 180),
  };
}

const VALID_CATEGORIES = [
  'Roman',
  'Klasikler',
  'Bilim Kurgu',
  'Tarih',
  'Felsefe',
  'Bilim',
  'Psikoloji',
  'Deneme',
  'Şiir',
  'Biyografi',
  'Öykü',
  'Sosyoloji',
  'Ekonomi',
  'Sanat',
  'Diğer',
];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '18mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // 1) Shelf Photo Analysis via Gemini Vision
  app.post('/api/scan-shelf', async (req, res) => {
    try {
      const {
        imageBase64,
        mimeType = 'image/jpeg',
        bookcaseName = 'Kitaplığım',
        startingShelf = 1,
      } = req.body ?? {};

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Lütfen geçerli bir kitaplık fotoğrafı yükleyin.' });
        return;
      }

      const ai = getGeminiClient();
      const base64Data = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;

      const systemInstruction = `Sen uzman bir kütüphaneci ve görsel kataloglama asistanısın.
Kullanıcının çektiği kitaplık fotoğrafındaki dizili kitapların sırtlarını dikkatlice oku.
Kurallar:
- Her rafı yukarıdan aşağıya doğru numaralandır (başlangıç raf numarası: ${Number(startingShelf) || 1}).
- Her raftaki okunabilir kitapları soldan sağa doğru 1'den başlayarak sırala (positionInShelf).
- Kitabın sırtındaki tam kitap adını (title), yazarını (author) ve yayınevini (publisher) çıkar.
- Eğer yazar veya yayınevi sırt yazısında kısmen görünüyorsa fakat kitap çok bilinen bir eserse doğru yazar ve yayınevi bilgisini tamamla; emin değilsen "Bilinmiyor" yaz.
- Kategori mutlaka şu listeden biri olmalı: ${VALID_CATEGORIES.join(', ')}.
- positionRegion değeri raf içindeki yatay konuma göre "Sol", "Orta" veya "Sağ" olmalı.
- spineColor kitap sırtının baskın rengini hex kodu olarak (#2D4A3E gibi) vermeli.
- box2d dizisi [ymin, xmin, ymax, xmax] formatında 0 ile 1000 arasında normalize edilmiş tam koordinatlar olmalı.
- confidence değeri yazının okunabilirliğine göre "yüksek", "orta" veya "düşük" olmalı.
- Yalnızca fotoğrafta gerçekten görünen ve en azından adı okunabilen veya ayırt edilebilen kitapları listele. En fazla 40 kitap döndür.`;

      const promptText = `"${bookcaseName}" kitaplığının bu fotoğrafındaki tüm okunabilir kitapları raf ve sıra bilgisiyle birlikte analiz et ve JSON olarak döndür.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: typeof mimeType === 'string' ? mimeType : 'image/jpeg',
                data: base64Data,
              },
            },
            { text: promptText },
          ],
        },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              totalShelvesDetected: {
                type: Type.INTEGER,
                description: 'Fotoğrafta tespit edilen toplam raf sayısı',
              },
              notes: {
                type: Type.STRING,
                description: 'Tarama kalitesi veya okunamayan kısımlar hakkında kısa Türkçe not',
              },
              books: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: 'Kitap adı' },
                    author: { type: Type.STRING, description: 'Yazar adı' },
                    publisher: { type: Type.STRING, description: 'Yayınevi adı' },
                    category: { type: Type.STRING, description: 'Kitap kategorisi' },
                    shelfRow: { type: Type.INTEGER, description: 'Üstten aşağıya raf numarası' },
                    positionInShelf: { type: Type.INTEGER, description: 'Soldan sağa raf içi sıra' },
                    positionRegion: { type: Type.STRING, description: 'Sol, Orta veya Sağ' },
                    spineColor: { type: Type.STRING, description: 'Hex renk kodu (#RRGGBB)' },
                    box2d: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                      description: '[ymin, xmin, ymax, xmax] 0-1000 arası',
                    },
                    confidence: { type: Type.STRING, description: 'yüksek, orta veya düşük' },
                  },
                  required: [
                    'title',
                    'author',
                    'publisher',
                    'category',
                    'shelfRow',
                    'positionInShelf',
                    'positionRegion',
                    'spineColor',
                    'confidence',
                  ],
                },
              },
            },
            required: ['totalShelvesDetected', 'books'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText || '{"totalShelvesDetected":1,"books":[]}');

      const sanitizedBooks = Array.isArray(parsed.books)
        ? parsed.books.map((item: Record<string, unknown>, idx: number) => {
            const region =
              item.positionRegion === 'Sol' ||
              item.positionRegion === 'Orta' ||
              item.positionRegion === 'Sağ'
                ? item.positionRegion
                : 'Orta';
            const confidence =
              item.confidence === 'yüksek' ||
              item.confidence === 'orta' ||
              item.confidence === 'düşük'
                ? item.confidence
                : 'orta';
            const cat =
              typeof item.category === 'string' && VALID_CATEGORIES.includes(item.category)
                ? item.category
                : 'Diğer';
            const hex =
              typeof item.spineColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(item.spineColor)
                ? item.spineColor
                : '#334155';
            const box =
              Array.isArray(item.box2d) && item.box2d.length === 4
                ? (item.box2d.map((n) => Math.max(0, Math.min(1000, Number(n) || 0))) as [
                    number,
                    number,
                    number,
                    number,
                  ])
                : undefined;

            return {
              tempId: `scan-${Date.now()}-${idx}`,
              selected: true,
              title: String(item.title || 'Adsız Kitap').trim(),
              author: String(item.author || 'Bilinmiyor').trim(),
              publisher: String(item.publisher || 'Bilinmiyor').trim(),
              category: cat,
              shelfRow: Math.max(1, Number(item.shelfRow) || Number(startingShelf) || 1),
              positionInShelf: Math.max(1, Number(item.positionInShelf) || idx + 1),
              positionRegion: region,
              spineColor: hex,
              box2d: box,
              confidence,
            };
          })
        : [];

      res.json({
        totalShelvesDetected: Math.max(1, Number(parsed.totalShelvesDetected) || 1),
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
        books: sanitizedBooks,
      });
    } catch (err) {
      const mapped = extractErrorMessage(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // 2) ISBN Barcode Lookup (Google Books + Open Library + Gemini Turkish metadata normalization)
  app.post('/api/lookup-isbn', async (req, res) => {
    try {
      const rawIsbn = typeof req.body?.isbn === 'string' ? req.body.isbn : '';
      const isbn = cleanIsbnInput(rawIsbn);
      if (isbn.length !== 10 && isbn.length !== 13) {
        res.status(400).json({
          error: 'Geçerli bir 10 veya 13 haneli ISBN barkod numarası girin (ör. 9789754700114).',
        });
        return;
      }

      let foundData: {
        isbn: string;
        title?: string;
        author?: string;
        publisher?: string;
        category?: string;
        pageCount?: number;
        publishYear?: number;
        description?: string;
      } = { isbn };

      let externalSource = '';

      // Try Google Books & Open Library in parallel with a 4.5s timeout
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);

      try {
        const [gbRes, olRes] = await Promise.allSettled([
          fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`, {
            signal: controller.signal,
          }).then((r) => (r.ok ? r.json() : null)),
          fetch(
            `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`,
            { signal: controller.signal }
          ).then((r) => (r.ok ? r.json() : null)),
        ]);

        if (gbRes.status === 'fulfilled' && gbRes.value?.items?.[0]?.volumeInfo) {
          const info = gbRes.value.items[0].volumeInfo;
          foundData.title = info.title || undefined;
          foundData.author = Array.isArray(info.authors) ? info.authors.join(', ') : undefined;
          foundData.publisher = info.publisher || undefined;
          foundData.category = Array.isArray(info.categories) ? info.categories[0] : undefined;
          foundData.pageCount = typeof info.pageCount === 'number' ? info.pageCount : undefined;
          const yearMatch = typeof info.publishedDate === 'string' ? info.publishedDate.match(/\d{4}/) : null;
          foundData.publishYear = yearMatch ? Number(yearMatch[0]) : undefined;
          foundData.description = typeof info.description === 'string' ? info.description.slice(0, 320) : undefined;
          externalSource = 'Google Books';
        }

        if (olRes.status === 'fulfilled' && olRes.value?.[`ISBN:${isbn}`]) {
          const ol = olRes.value[`ISBN:${isbn}`];
          foundData.title = foundData.title || ol.title || undefined;
          foundData.author =
            foundData.author ||
            (Array.isArray(ol.authors)
              ? ol.authors.map((a: { name?: string }) => a.name).filter(Boolean).join(', ')
              : undefined);
          foundData.publisher =
            foundData.publisher ||
            (Array.isArray(ol.publishers) && ol.publishers[0]?.name
              ? ol.publishers[0].name
              : undefined);
          foundData.pageCount =
            foundData.pageCount || (typeof ol.number_of_pages === 'number' ? ol.number_of_pages : undefined);
          const olYear =
            typeof ol.publish_date === 'string' ? ol.publish_date.match(/\d{4}/) : null;
          foundData.publishYear = foundData.publishYear || (olYear ? Number(olYear[0]) : undefined);
          if (!externalSource) externalSource = 'Open Library';
        }
      } finally {
        clearTimeout(timer);
      }

      // Enrich / normalize with Gemini (especially helpful for Turkish ISBNs & Turkish categories)
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
        try {
          const ai = getGeminiClient();
          const prompt = foundData.title
            ? `Aşağıdaki ISBN kaydını Türkçe kütüphane kataloğu için düzenle. Eksik yayınevi/kategori bilgisi varsa tamamla ve kategoriyi şu listeden seç: ${VALID_CATEGORIES.join(', ')}.
Kayıt: ${JSON.stringify(foundData)}`
            : `ISBN "${isbn}" numaralı kitabı biliyorsan Türkçe baskı bilgilerini (kitap adı, yazar, yayınevi, kategori, sayfa sayısı, basım yılı) JSON olarak ver. Eğer bu ISBN'den kesin olarak emin değilsen found alanını false döndür, uydurma bilgi üretme. Kategori listesi: ${VALID_CATEGORIES.join(', ')}.`;

          const aiRes = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  found: { type: Type.BOOLEAN },
                  title: { type: Type.STRING },
                  author: { type: Type.STRING },
                  publisher: { type: Type.STRING },
                  category: { type: Type.STRING },
                  pageCount: { type: Type.INTEGER },
                  publishYear: { type: Type.INTEGER },
                  description: { type: Type.STRING },
                },
                required: ['found'],
              },
            },
          });

          const enriched = JSON.parse((aiRes.text ?? '{}').trim());
          if (foundData.title || enriched.found) {
            foundData = {
              isbn,
              title: foundData.title || enriched.title || undefined,
              author: foundData.author || enriched.author || undefined,
              publisher: foundData.publisher || enriched.publisher || undefined,
              category:
                typeof enriched.category === 'string' && VALID_CATEGORIES.includes(enriched.category)
                  ? enriched.category
                  : 'Diğer',
              pageCount: foundData.pageCount || (Number(enriched.pageCount) > 0 ? Number(enriched.pageCount) : undefined),
              publishYear:
                foundData.publishYear || (Number(enriched.publishYear) > 1000 ? Number(enriched.publishYear) : undefined),
              description: foundData.description || enriched.description || undefined,
            };
            if (!externalSource && enriched.found) {
              externalSource = 'Katalog Dizini';
            }
          }
        } catch {
          // If Gemini enrichment fails while external API already succeeded, keep external API result
        }
      }

      if (!foundData.title) {
        res.json({
          found: false,
          isbn,
          message:
            'Bu ISBN numarası çevrimiçi kataloglarda bulunamadı. Kitap bilgilerini aşağıdan manuel olarak tamamlayıp kaydedebilirsiniz.',
        });
        return;
      }

      res.json({
        found: true,
        source: externalSource || 'Katalog',
        book: {
          isbn,
          title: foundData.title,
          author: foundData.author || 'Bilinmiyor',
          publisher: foundData.publisher || 'Bilinmiyor',
          category:
            foundData.category && VALID_CATEGORIES.includes(foundData.category)
              ? foundData.category
              : 'Roman',
          pageCount: foundData.pageCount,
          publishYear: foundData.publishYear,
          description: foundData.description,
        },
      });
    } catch (err) {
      const mapped = extractErrorMessage(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build bulunamadı.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rafİzi sunucusu http://localhost:${PORT} adresinde çalışıyor.`);
  });
}

startServer().catch((err) => {
  console.error('Sunucu başlatılamadı:', err);
  process.exit(1);
});
