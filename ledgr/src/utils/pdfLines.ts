/** How close two items' y-coordinates need to be (in PDF points) to count as
 *  the same visual line. Small enough to not merge adjacent table rows,
 *  large enough to absorb minor baseline jitter within a single row. */
const LINE_TOLERANCE = 2;

export interface TextItem {
  str: string;
  x: number;
  y: number;
}

/** Group extracted PDF text items into lines by vertical position, ordering
 *  each line's items left-to-right, and join lines with '\n'.
 *
 *  pdf.js returns text items with no inherent row/column structure — without
 *  this, a whole page (including every table row) collapses into one long
 *  space-separated string, which makes it much harder for the downstream LLM
 *  parser to tell where one transaction row ends and the next begins, or to
 *  recognize section headers on their own line. Reconstructing lines here
 *  preserves the statement's visual table layout instead. */
export function linesFromItems(items: TextItem[]): string {
  if (items.length === 0) return '';

  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [];
  let currentY: number | null = null;

  for (const item of sorted) {
    if (currentY === null || Math.abs(item.y - currentY) <= LINE_TOLERANCE) {
      currentLine.push(item);
      currentY ??= item.y;
    } else {
      lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  const text = lines
    .map((line) =>
      [...line]
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((line) => line.length > 0)
    .join('\n');

  return mergeContinuationLines(text);
}

/** A line that opens a transaction row: starts with a date like "07/27" or
 *  "07/27/2026" (many statements print two dates — transaction + posting —
 *  but only the first needs to match here). */
const DATE_PREFIX = /^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/;

/** Lines that are structural (section headers, subtotals, page footers) even
 *  though they don't start with a date — never merge these into the row
 *  above them. */
const STRUCTURAL_LINE = /^(total\b|transaction|date\b|page\s+\d|account\b|statement\b|balance\b)/i;

/** Any digit at all. A genuine continuation line (flight date, itinerary
 *  code, reference number, ...) almost always carries at least one; a
 *  section label like "Purchases and Adjustments" or "Interest Charged"
 *  never does. Requiring a digit keeps unlabeled section headers from being
 *  swallowed into the transaction row above them. */
const HAS_DIGIT = /\d/;

/** Merge a "continuation" line — one with no date/amount of its own, such as
 *  a passenger name and flight itinerary printed under an airline charge, or
 *  a memo line under a purchase — into the transaction row directly above it.
 *
 *  Without this, a line like "CHI/HSUAN 08/05 LGA/ORD RNDTRP ORD/LGA" sits on
 *  its own line right after its transaction row, and an LLM asked to extract
 *  "clean" transaction rows can end up treating it as an ambiguous row of its
 *  own and skipping the whole charge. Folding it into the row above removes
 *  that ambiguity structurally instead of relying on prompt wording alone. */
export function mergeContinuationLines(text: string): string {
  const lines = text.split('\n');
  const merged: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    const prev = merged[merged.length - 1];

    if (
      prev !== undefined &&
      DATE_PREFIX.test(prev) &&
      line.length > 0 &&
      !DATE_PREFIX.test(line) &&
      !STRUCTURAL_LINE.test(line) &&
      HAS_DIGIT.test(line)
    ) {
      merged[merged.length - 1] = `${prev} | ${line}`;
    } else {
      merged.push(line);
    }
  }

  return merged.join('\n');
}
