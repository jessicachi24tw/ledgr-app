import * as pdfjsLib from 'pdfjs-dist';
import type { ParsedTransaction } from '../types';
import { parseTransactions } from './llmParser';
import { linesFromItems, type TextItem } from '../utils/pdfLines';

// Use the bundled worker via a local URL so Vite serves it correctly
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Lowered from 3 — now that PDF text preserves one row per line (see
// linesFromItems), the LLM finds and extracts more genuine transaction rows
// per page, so a smaller batch keeps each request's output comfortably
// under the token limit instead of risking truncation on a busy statement.
const PAGES_PER_BATCH = 2;

/** Extract text from each page of a PDF, returning one string per page. */
async function extractPagesFromPDF(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items: TextItem[] = content.items
      .filter((item) => 'str' in item)
      .map((item) => {
        const transform = (item as { transform: number[] }).transform;
        return { str: (item as { str: string }).str, x: transform[4] ?? 0, y: transform[5] ?? 0 };
      });
    pages.push(linesFromItems(items));
  }

  return pages;
}

/** Parse pasted text with the configured LLM. Re-exported for use by PasteImportTab. */
export async function parseWithLLM(text: string): Promise<ParsedTransaction[]> {
  return parseTransactions(text);
}

/** Parse a PDF file in batches of pages to avoid LLM output token limits.
 *  onProgress(batchIndex, totalBatches) is called before each batch. */
export async function parsePDFStatement(
  file: File,
  onProgress?: (batch: number, total: number) => void,
): Promise<ParsedTransaction[]> {
  const pages = await extractPagesFromPDF(file);

  const batches: string[] = [];
  for (let i = 0; i < pages.length; i += PAGES_PER_BATCH) {
    batches.push(pages.slice(i, i + PAGES_PER_BATCH).join('\n\n--- PAGE BREAK ---\n\n'));
  }

  const all: ParsedTransaction[] = [];
  const failedBatches: number[] = [];
  for (let i = 0; i < batches.length; i++) {
    onProgress?.(i + 1, batches.length);
    try {
      const parsed = await parseTransactions(batches[i]);
      all.push(...parsed);
    } catch (err) {
      // Don't let one bad batch (e.g. a boilerplate-only page pair the LLM
      // mishandled) wipe out transactions successfully found in other
      // batches — skip it and keep going.
      failedBatches.push(i + 1);
      console.error(`[parsePDFStatement] batch ${i + 1}/${batches.length} failed and was skipped:`, err);
    }
  }

  if (failedBatches.length > 0 && all.length === 0) {
    // Every batch failed — don't silently return an empty result.
    throw new Error(
      `Could not parse any transactions (${failedBatches.length} of ${batches.length} batch${batches.length !== 1 ? 'es' : ''} failed). Check the browser console for details.`
    );
  }

  return all;
}
