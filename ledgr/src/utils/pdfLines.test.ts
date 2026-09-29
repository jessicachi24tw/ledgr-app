import { describe, it, expect } from 'vitest';
import { linesFromItems, mergeContinuationLines, type TextItem } from './pdfLines';

describe('linesFromItems', () => {
  it('returns an empty string for no items', () => {
    expect(linesFromItems([])).toBe('');
  });

  it('joins items on the same line left-to-right regardless of input order', () => {
    const items: TextItem[] = [
      { str: 'Amount', x: 300, y: 500 },
      { str: 'Date', x: 10, y: 500 },
      { str: 'Description', x: 100, y: 500 },
    ];
    expect(linesFromItems(items)).toBe('Date Description Amount');
  });

  it('splits items into separate lines by y position, top to bottom', () => {
    const items: TextItem[] = [
      { str: 'row2', x: 10, y: 480 },
      { str: 'row1', x: 10, y: 500 },
      { str: 'row3', x: 10, y: 460 },
    ];
    expect(linesFromItems(items)).toBe('row1\nrow2\nrow3');
  });

  it('treats items within the y-tolerance as the same line (baseline jitter)', () => {
    const items: TextItem[] = [
      { str: 'left', x: 10, y: 500 },
      { str: 'right', x: 200, y: 501.5 }, // within 2pt tolerance
    ];
    expect(linesFromItems(items)).toBe('left right');
  });

  it('treats items beyond the y-tolerance as different lines', () => {
    const items: TextItem[] = [
      { str: 'top', x: 10, y: 500 },
      { str: 'bottom', x: 10, y: 495 }, // 5pt away, beyond tolerance
    ];
    expect(linesFromItems(items)).toBe('top\nbottom');
  });

  it('reconstructs a small transaction table with a header row and section labels', () => {
    // Mirrors the shape of a real statement: a "Transactions" heading,
    // a column header row, a sub-section label, then transaction rows.
    const items: TextItem[] = [
      { str: 'Transactions', x: 10, y: 700 },
      { str: 'Date', x: 10, y: 680 },
      { str: 'Description', x: 80, y: 680 },
      { str: 'Amount', x: 400, y: 680 },
      { str: 'Purchases and Adjustments', x: 10, y: 660 },
      { str: '07/25', x: 10, y: 640 },
      { str: 'US1 SUPERMARKET INC', x: 80, y: 640 },
      { str: '32.41', x: 400, y: 640 },
      { str: '07/26', x: 10, y: 620 },
      { str: 'OMNY VENDING*', x: 80, y: 620 },
      { str: '20.00', x: 400, y: 620 },
    ];
    expect(linesFromItems(items)).toBe(
      [
        'Transactions',
        'Date Description Amount',
        'Purchases and Adjustments',
        '07/25 US1 SUPERMARKET INC 32.41',
        '07/26 OMNY VENDING* 20.00',
      ].join('\n')
    );
  });

  it('collapses multiple spaces within a reconstructed line', () => {
    const items: TextItem[] = [
      { str: '  padded  ', x: 10, y: 500 },
      { str: 'text', x: 100, y: 500 },
    ];
    expect(linesFromItems(items)).toBe('padded text');
  });

  it('drops lines that end up empty after trimming', () => {
    const items: TextItem[] = [
      { str: 'real line', x: 10, y: 500 },
      { str: '   ', x: 10, y: 480 },
      { str: 'another real line', x: 10, y: 460 },
    ];
    expect(linesFromItems(items)).toBe('real line\nanother real line');
  });

  it('folds a real-world airline continuation line into its transaction row (regression: dropped rows)', () => {
    // Reproduces the exact Bank of America statement layout that caused
    // under-extraction: two airline charges, each followed by a
    // passenger/itinerary line with no date or amount of its own.
    const items: TextItem[] = [
      { str: '07/27', x: 10, y: 500 },
      { str: '07/27', x: 60, y: 500 },
      { str: 'AMERICAN AIR0012363314781FORT WORTH TX', x: 110, y: 500 },
      { str: '8746', x: 400, y: 500 },
      { str: '2215', x: 440, y: 500 },
      { str: '345.80', x: 480, y: 500 },
      { str: 'CHI/HSUAN', x: 110, y: 488 },
      { str: '08/05', x: 160, y: 488 },
      { str: 'LGA/ORD', x: 200, y: 488 },
      { str: 'RNDTRP', x: 250, y: 488 },
      { str: 'ORD/LGA', x: 300, y: 488 },
      { str: '07/27', x: 10, y: 476 },
      { str: '07/27', x: 60, y: 476 },
      { str: 'AMERICAN AIR0012363314782FORT WORTH TX', x: 110, y: 476 },
      { str: '8753', x: 400, y: 476 },
      { str: '2215', x: 440, y: 476 },
      { str: '345.80', x: 480, y: 476 },
      { str: 'HUANG/YUNJOU', x: 110, y: 464 },
      { str: '08/05', x: 170, y: 464 },
      { str: 'LGA/ORD', x: 210, y: 464 },
      { str: 'RNDTRP', x: 260, y: 464 },
      { str: 'ORD/LGA', x: 310, y: 464 },
    ];

    expect(linesFromItems(items)).toBe(
      [
        '07/27 07/27 AMERICAN AIR0012363314781FORT WORTH TX 8746 2215 345.80 | CHI/HSUAN 08/05 LGA/ORD RNDTRP ORD/LGA',
        '07/27 07/27 AMERICAN AIR0012363314782FORT WORTH TX 8753 2215 345.80 | HUANG/YUNJOU 08/05 LGA/ORD RNDTRP ORD/LGA',
      ].join('\n')
    );
  });
});

describe('mergeContinuationLines', () => {
  it('merges a non-date line into the transaction row above it', () => {
    const text = [
      '07/27 07/27 AMERICAN AIR... 345.80',
      'CHI/HSUAN 08/05 LGA/ORD RNDTRP ORD/LGA',
    ].join('\n');
    expect(mergeContinuationLines(text)).toBe(
      '07/27 07/27 AMERICAN AIR... 345.80 | CHI/HSUAN 08/05 LGA/ORD RNDTRP ORD/LGA'
    );
  });

  it('does not merge a second transaction row that also starts with a date', () => {
    const text = [
      '07/26 07/27 PAYMENT FROM SAV -810.51',
      '08/06 08/06 PAYMENT FROM SAV -1,050.82',
    ].join('\n');
    expect(mergeContinuationLines(text)).toBe(text);
  });

  it('does not merge a TOTAL subtotal line into the row above it', () => {
    const text = [
      '08/06 08/06 PAYMENT FROM SAV -1,050.82',
      'TOTAL PAYMENTS AND OTHER CREDITS FOR THIS PERIOD -$1,861.33',
    ].join('\n');
    expect(mergeContinuationLines(text)).toBe(text);
  });

  it('does not merge a section heading into the row above it', () => {
    const text = [
      '08/06 08/06 PAYMENT FROM SAV -1,050.82',
      'Purchases and Adjustments',
    ].join('\n');
    expect(mergeContinuationLines(text)).toBe(text);
  });

  it('does not merge when the line above is not a transaction row', () => {
    const text = ['Transactions', 'some stray line'].join('\n');
    expect(mergeContinuationLines(text)).toBe(text);
  });

  it('merges multiple consecutive continuation lines into the same row', () => {
    const text = ['07/27 07/27 SOMETHING 10.00', 'ref 123', 'note 456'].join('\n');
    expect(mergeContinuationLines(text)).toBe('07/27 07/27 SOMETHING 10.00 | ref 123 | note 456');
  });

  it('does not merge a digit-free continuation-like line (conservative default)', () => {
    // Without a digit to signal "this is real transaction detail", the safer
    // default is to leave it on its own line rather than risk swallowing an
    // unrecognized section label into the row above.
    const text = ['07/27 07/27 SOMETHING 10.00', 'Thank you for your purchase'].join('\n');
    expect(mergeContinuationLines(text)).toBe(text);
  });
});
