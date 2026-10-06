import * as pdfjsLib from 'pdfjs-dist';

// Configure worker safely for Vite environment
try {
  if (typeof window !== 'undefined') {
    // Use matching CDN worker or Vite worker import
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('PDF Worker setup note:', e);
}

export async function extractTextFromPdf(file: File | ArrayBuffer): Promise<string> {
  const data = file instanceof File ? await file.arrayBuffer() : file;
  
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    
    // Group text items with attention to vertical/horizontal positions
    const items = content.items as any[];
    let lastY: number | null = null;
    let pageString = '';

    for (const item of items) {
      if ('str' in item) {
        const text = item.str;
        // In PDF coordinate space, if Y changes significantly, it's a new line
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
}
