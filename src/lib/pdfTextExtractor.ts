import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import * as fflate from 'fflate';
import { cleanStatementIntroAndJunk } from './statementParser';

// Configure PDF.js fake worker in-process on main thread
// This completely avoids Web Worker instantiation issues, iframe CORS/sandbox blocks,
// and worker load timeouts in AI Studio preview environments.
try {
  (globalThis as any).pdfjsWorker = pdfjsWorker;
  if (typeof window !== 'undefined') {
    (window as any).pdfjsWorker = pdfjsWorker;
  }
  // Disable worker fetching
  if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
} catch (e) {
  console.warn('PDF.js worker setup note:', e);
}

// Check if raw array buffer starts with %PDF magic header
export function isPdfBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 5) return false;
  const uint8 = new Uint8Array(buffer, 0, 5);
  // %PDF-
  return uint8[0] === 0x25 && uint8[1] === 0x50 && uint8[2] === 0x44 && uint8[3] === 0x46;
}

// Decode PDF string escapes (octal escapes, parentheses, backslashes, etc.)
function decodePdfString(rawStr: string): string {
  let decoded = rawStr.replace(/\\([0-7]{1,3})/g, (_, oct) => {
    try {
      const charCode = parseInt(oct, 8);
      return String.fromCharCode(charCode);
    } catch {
      return '';
    }
  });

  return decoded
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

// Decode hex encoded PDF text string <00410042>
function decodePdfHexString(rawHex: string): string {
  const cleanHex = rawHex.replace(/\s+/g, '');
  let result = '';
  // Check if UTF-16BE (starts with FEFF)
  if (cleanHex.toUpperCase().startsWith('FEFF')) {
    for (let i = 4; i < cleanHex.length; i += 4) {
      const code = parseInt(cleanHex.substring(i, i + 4), 16);
      if (!isNaN(code)) result += String.fromCharCode(code);
    }
    return result;
  }
  // Standard 8-bit or 16-bit
  if (cleanHex.length % 2 === 0) {
    for (let i = 0; i < cleanHex.length; i += 2) {
      const code = parseInt(cleanHex.substring(i, i + 2), 16);
      if (!isNaN(code)) result += String.fromCharCode(code);
    }
  }
  return result;
}

// Fast synchronous stream decompressor using fflate (never throws uncaught header errors)
function safeDecompressSync(streamBytes: Uint8Array): Uint8Array | null {
  if (streamBytes.length < 2) return null;

  // 1. Try standard zlib (RFC 1950)
  try {
    return fflate.unzlibSync(streamBytes);
  } catch {
    // ignore
  }

  // 2. Try raw deflate (RFC 1951)
  try {
    return fflate.inflateSync(streamBytes);
  } catch {
    // ignore
  }

  // 3. Try slicing off any leading whitespace or newline bytes
  let offset = 0;
  while (offset < 8 && offset < streamBytes.length && (streamBytes[offset] === 10 || streamBytes[offset] === 13 || streamBytes[offset] === 32)) {
    offset++;
  }
  if (offset > 0) {
    const sliced = streamBytes.subarray(offset);
    try {
      return fflate.unzlibSync(sliced);
    } catch {
      // ignore
    }
    try {
      return fflate.inflateSync(sliced);
    } catch {
      // ignore
    }
  }

  return null;
}

interface TextFragment {
  x: number;
  y: number;
  text: string;
  pageIndex: number;
}

// Tokenize PDF content stream text operators (BT, ET, Tm, Td, TD, TL, T*, Tj, TJ, ', ")
function parseStreamText(streamContent: string, pageIndex: number): TextFragment[] {
  const frags: TextFragment[] = [];
  let curX = 0;
  let curY = 0;
  let leading = 12;

  // Regex matches PDF text operators and positions
  const tokenRegex = /(-?[0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)\s+Tm|(-?[0-9.]+)\s+(-?[0-9.]+)\s+Td|(-?[0-9.]+)\s+(-?[0-9.]+)\s+TD|(-?[0-9.]+)\s+TL|T\*|\((?:[^()\\\\]|\\\\.)*\)\s*(?:Tj|'|")|<[0-9a-fA-F\s]+>\s*(?:Tj|'|")|\[(?:[^\[\]\\\\]|\\\\.)*\]\s*TJ/g;

  let m;
  while ((m = tokenRegex.exec(streamContent)) !== null) {
    const matched = m[0].trim();

    if (m[1] !== undefined) {
      // Tm: a b c d e f Tm
      curX = parseFloat(m[5]);
      curY = parseFloat(m[6]);
    } else if (m[7] !== undefined) {
      // Td: tx ty Td
      curX += parseFloat(m[7]);
      curY += parseFloat(m[8]);
    } else if (m[9] !== undefined) {
      // TD: tx ty TD
      curX += parseFloat(m[9]);
      curY += parseFloat(m[10]);
      leading = -parseFloat(m[10]);
    } else if (m[11] !== undefined) {
      // TL: leading
      leading = parseFloat(m[11]);
    } else if (matched === 'T*') {
      curY -= leading;
    } else if (matched.endsWith('TJ')) {
      // TJ array: [(str1) num (str2) ...] TJ
      const inner = matched.substring(1, matched.length - 3);
      const partsRegex = /\((.*?)\)|<([0-9a-fA-F]+)>/g;
      let part;
      let linePart = '';
      while ((part = partsRegex.exec(inner)) !== null) {
        if (part[1] !== undefined) {
          linePart += decodePdfString(part[1]);
        } else if (part[2] !== undefined) {
          linePart += decodePdfHexString(part[2]);
        }
      }
      if (linePart.trim().length > 0) {
        frags.push({ x: curX, y: curY, text: linePart, pageIndex });
      }
    } else if (matched.startsWith('(')) {
      // (string) Tj or ' or "
      const lastParen = matched.lastIndexOf(')');
      const rawStr = matched.substring(1, lastParen);
      const decoded = decodePdfString(rawStr);
      if (decoded.trim().length > 0) {
        frags.push({ x: curX, y: curY, text: decoded, pageIndex });
      }
    } else if (matched.startsWith('<')) {
      // <hex> Tj
      const lastGt = matched.lastIndexOf('>');
      const rawHex = matched.substring(1, lastGt);
      const decoded = decodePdfHexString(rawHex);
      if (decoded.trim().length > 0) {
        frags.push({ x: curX, y: curY, text: decoded, pageIndex });
      }
    }
  }

  return frags;
}

// Pure JS PDF Text & Table Extractor using fflate
// Scans PDF stream objects, decompresses via fflate, parses BT/ET text operators,
// tracks Tm/Td coordinate positions, and groups items by row into structured lines.
export function pureJsExtractPdf(buffer: ArrayBuffer): string {
  try {
    const uint8 = new Uint8Array(buffer);
    const decoder = new TextDecoder('latin1');
    const rawContent = decoder.decode(uint8);

    const streamHeader = 'stream';
    const streamEnd = 'endstream';
    let searchIdx = 0;

    const allFragments: TextFragment[] = [];
    let pageCount = 0;

    while ((searchIdx = rawContent.indexOf(streamHeader, searchIdx)) !== -1) {
      // Ensure stream marker is preceded by whitespace, dictionary close, or newline
      const prevChar = searchIdx > 0 ? rawContent[searchIdx - 1] : '\n';
      if (!/[\s\r\n\>]/.test(prevChar)) {
        searchIdx += 6;
        continue;
      }

      // Check dictionary before stream for explicit /Length
      const dictLookback = rawContent.substring(Math.max(0, searchIdx - 200), searchIdx);
      const lengthMatch = dictLookback.match(/\/Length\s+(\d+)/);
      const explicitLength = lengthMatch ? parseInt(lengthMatch[1], 10) : 0;

      let streamStart = searchIdx + streamHeader.length;
      if (rawContent[streamStart] === '\r') streamStart++;
      if (rawContent[streamStart] === '\n') streamStart++;

      let streamStop = -1;
      if (explicitLength > 0 && streamStart + explicitLength <= uint8.length) {
        streamStop = streamStart + explicitLength;
      } else {
        streamStop = rawContent.indexOf(streamEnd, streamStart);
      }

      if (streamStop === -1 || streamStop <= streamStart) {
        searchIdx = streamStart + 1;
        continue;
      }

      const streamBytes = uint8.subarray(streamStart, streamStop);
      const decompressed = safeDecompressSync(streamBytes);
      const contentStr = decompressed ? decoder.decode(decompressed) : decoder.decode(streamBytes);

      // Check if this stream contains text operators
      if (contentStr.includes('BT') && (contentStr.includes('Tj') || contentStr.includes('TJ') || contentStr.includes('Tm') || contentStr.includes('Td'))) {
        pageCount++;
        const frags = parseStreamText(contentStr, pageCount);
        allFragments.push(...frags);
      }

      searchIdx = streamStop + streamEnd.length;
    }

    if (allFragments.length === 0) {
      return '';
    }

    // Group fragments by page, then cluster into visual lines by Y coordinate
    const pagesMap = new Map<number, TextFragment[]>();
    for (const frag of allFragments) {
      if (!pagesMap.has(frag.pageIndex)) {
        pagesMap.set(frag.pageIndex, []);
      }
      pagesMap.get(frag.pageIndex)!.push(frag);
    }

    const reconstructedPages: string[] = [];
    const Y_TOLERANCE = 4.5;

    for (const [, pageFrags] of pagesMap) {
      interface LineCluster {
        avgY: number;
        items: Array<{ x: number; text: string }>;
      }

      const clusters: LineCluster[] = [];

      for (const frag of pageFrags) {
        let matched = clusters.find(c => Math.abs(c.avgY - frag.y) <= Y_TOLERANCE);
        if (matched) {
          matched.items.push({ x: frag.x, text: frag.text });
          matched.avgY = (matched.avgY * (matched.items.length - 1) + frag.y) / matched.items.length;
        } else {
          clusters.push({ avgY: frag.y, items: [{ x: frag.x, text: frag.text }] });
        }
      }

      // Sort lines by Y descending (top to bottom of page)
      clusters.sort((a, b) => b.avgY - a.avgY);

      const pageLines: string[] = [];
      for (const cluster of clusters) {
        // Sort items in line by X ascending (left to right)
        cluster.items.sort((a, b) => a.x - b.x);
        const lineText = cluster.items
          .map(i => i.text.trim())
          .filter(Boolean)
          .join(' ');
        if (lineText.length > 0) {
          pageLines.push(lineText);
        }
      }

      if (pageLines.length > 0) {
        reconstructedPages.push(pageLines.join('\n'));
      }
    }

    return reconstructedPages.join('\n\n--- NOVA PAGINA ---\n\n');
  } catch (err) {
    console.warn('pureJsExtractPdf error:', err);
    return '';
  }
}

// Main PDF text extraction function with line clustering and multi-engine resilience
export async function extractTextFromPdf(file: File | ArrayBuffer): Promise<string> {
  const originalBuffer = file instanceof File ? await file.arrayBuffer() : file;

  // Primary attempt: PDF.js with in-process fake worker (runs directly on main thread, fast and comprehensive)
  const pdfjsAttempt = async (): Promise<string> => {
    // Ensure in-process fake worker is configured
    try {
      (globalThis as any).pdfjsWorker = pdfjsWorker;
      if (typeof window !== 'undefined') {
        (window as any).pdfjsWorker = pdfjsWorker;
      }
    } catch {
      // ignore
    }

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(originalBuffer.slice(0)),
      disableFontFace: true,
      stopAtErrors: false,
      useSystemFonts: false,
      useWorkerFetch: false,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const rawItems = (content.items as any[]).filter(
        item => item && 'str' in item && typeof item.str === 'string' && item.str.length > 0
      );

      // Sort items by Y descending
      rawItems.sort((a, b) => b.transform[5] - a.transform[5]);

      // Visual line clustering by Y coordinate (4.5px tolerance)
      interface LineCluster {
        avgY: number;
        items: Array<{ str: string; x: number }>;
      }

      const clusters: LineCluster[] = [];
      const Y_THRESHOLD = 4.5;

      for (const item of rawItems) {
        const x = item.transform[4];
        const y = item.transform[5];
        const str = item.str;

        let matched = clusters.find(c => Math.abs(c.avgY - y) <= Y_THRESHOLD);
        if (matched) {
          matched.items.push({ str, x });
          matched.avgY = (matched.avgY * (matched.items.length - 1) + y) / matched.items.length;
        } else {
          clusters.push({ avgY: y, items: [{ str, x }] });
        }
      }

      clusters.sort((a, b) => b.avgY - a.avgY);

      const pageLines: string[] = [];
      for (const cluster of clusters) {
        cluster.items.sort((a, b) => a.x - b.x);
        let lineText = '';
        for (const it of cluster.items) {
          const s = it.str.trim();
          if (!s) continue;
          if (lineText.length > 0 && !lineText.endsWith(' ')) {
            lineText += ' ';
          }
          lineText += s;
        }
        if (lineText.trim().length > 0) {
          pageLines.push(lineText.trim());
        }
      }

      pageTexts.push(pageLines.join('\n'));
    }

    return pageTexts.join('\n\n--- NOVA PAGINA ---\n\n');
  };

  let extracted = '';

  // Attempt PDF.js first with a safety timeout of 3.5s
  try {
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('PDFJS_TIMEOUT')), 3500);
    });

    const result = await Promise.race([pdfjsAttempt(), timeoutPromise]);
    if (result && result.trim().length > 20) {
      extracted = result;
    }
  } catch (err: any) {
    console.info('PDF.js engine skipped or timed out, switching to pure JS extractor:', err?.message || err);
  }

  // Pure JS fallback with fflate (runs in <15ms, zero worker overhead, zero uncaught stream errors)
  if (!extracted) {
    const fallbackText = pureJsExtractPdf(originalBuffer);
    if (fallbackText && fallbackText.trim().length > 15) {
      extracted = fallbackText;
    }
  }

  // If text is still empty, throw friendly Portuguese explanation
  if (!extracted || extracted.trim().length < 15) {
    throw new Error('O arquivo PDF parece ser uma imagem escaneada sem camada de texto selecionável. Caso queira, utilize a aba "Copiar e Colar" para colar o texto do extrato.');
  }

  // Automatically clean presentation, headers, addresses, account data and keep only relevant transaction lines
  const cleanResult = cleanStatementIntroAndJunk(extracted);
  return cleanResult.cleanedText && cleanResult.cleanedText.length > 20 ? cleanResult.cleanedText : extracted;
}
