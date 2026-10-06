import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error Vite query import
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure bundled worker safely for browser & mobile environment
try {
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  }
} catch (e) {
  console.warn('PDF Worker setup note:', e);
}

// Check if raw array buffer starts with %PDF
export function isPdfBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 5) return false;
  const uint8 = new Uint8Array(buffer, 0, 5);
  // %PDF-
  return uint8[0] === 0x25 && uint8[1] === 0x50 && uint8[2] === 0x44 && uint8[3] === 0x46;
}

// Fallback pure-JS PDF stream extractor in case Web Worker or pdfjs encounters mobile sandbox limits
async function fallbackExtractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder('latin1');
    const rawContent = decoder.decode(bytes);

    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    const extractedBlocks: string[] = [];
    let match;

    while ((match = streamRegex.exec(rawContent)) !== null) {
      const streamDataString = match[1];
      const streamBytes = new Uint8Array(streamDataString.length);
      for (let i = 0; i < streamDataString.length; i++) {
        streamBytes[i] = streamDataString.charCodeAt(i);
      }

      let decompressed = '';
      // Try DecompressionStream ('deflate')
      if (typeof DecompressionStream !== 'undefined') {
        try {
          const ds = new DecompressionStream('deflate');
          const writer = ds.writable.getWriter();
          writer.write(streamBytes);
          writer.close();
          const reader = ds.readable.getReader();
          const chunks: Uint8Array[] = [];
          let totalLen = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              totalLen += value.length;
            }
          }
          const combined = new Uint8Array(totalLen);
          let offset = 0;
          for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.length;
          }
          decompressed = new TextDecoder('latin1').decode(combined);
        } catch {
          // If deflate fails, it might be uncompressed stream
          decompressed = streamDataString;
        }
      } else {
        decompressed = streamDataString;
      }

      // Extract text strings from PDF commands: (text) Tj or [(t1)(t2)] TJ
      if (decompressed.includes('BT') || decompressed.includes('Tj') || decompressed.includes('TJ')) {
        const textParts: string[] = [];
        const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
        let tMatch;
        while ((tMatch = tjRegex.exec(decompressed)) !== null) {
          textParts.push(tMatch[1]);
        }

        const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
        let arrMatch;
        while ((arrMatch = arrayTjRegex.exec(decompressed)) !== null) {
          const inner = arrMatch[1];
          const innerMatches = inner.match(/\(([^)]+)\)/g);
          if (innerMatches) {
            textParts.push(innerMatches.map(m => m.slice(1, -1)).join(' '));
          }
        }

        if (textParts.length > 0) {
          extractedBlocks.push(textParts.join('\n'));
        }
      }
    }

    return extractedBlocks.join('\n');
  } catch (err) {
    console.warn('Fallback PDF extraction error:', err);
    return '';
  }
}

// Main PDF text extraction function with mobile timeout and fallback
export async function extractTextFromPdf(file: File | ArrayBuffer): Promise<string> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;

  // Primary attempt using pdfjs-dist with 8s timeout
  const pdfjsAttempt = async (): Promise<string> => {
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      stopAtErrors: false,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      
      const items = content.items as any[];
      let lastY: number | null = null;
      let pageString = '';

      for (const item of items) {
        if ('str' in item) {
          const text = item.str;
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
            pageString += '\n';
          } else if (pageString.length > 0 && !pageString.endsWith('\n') && !pageString.endsWith(' ')) {
            pageString += ' ';
          }
          pageString += text;
          lastY = item.transform[5];
        }
      }

      pageTexts.push(pageString);
    }

    return pageTexts.join('\n\n--- NOVA PAGINA ---\n\n');
  };

  try {
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('PDFJS_TIMEOUT')), 8000);
    });

    return await Promise.race([pdfjsAttempt(), timeoutPromise]);
  } catch (err: any) {
    console.warn('pdfjs extraction failed or timed out on this device, trying native fallback:', err);
    const fallbackText = await fallbackExtractPdfText(arrayBuffer);
    if (fallbackText && fallbackText.trim().length > 20) {
      return fallbackText;
    }
    throw new Error(err?.message || 'Não foi possível extrair o texto do arquivo PDF.');
  }
}
