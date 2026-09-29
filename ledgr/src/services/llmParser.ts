import { CATEGORIES, type ParsedTransaction } from '../types';

function buildPrompt(text: string): string {
  const categoriesList = CATEGORIES.join(', ');
  return `You are a bank statement parser. Extract all debit/expense transactions from the following bank statement text and return them as a JSON array.

Your entire response must be that JSON array — never a description, summary, or explanation of the document, even in these cases:
- This chunk of the statement has zero transaction rows in it (e.g. it's only a cover page, account summary, payment coupon, or legal/interest terms) — respond with exactly [] and nothing else.
- You're unsure whether something qualifies — still respond with JSON only (an empty array, or the array of rows you are confident about); do not switch to prose to explain your uncertainty.

Rules:
- The text below has one line per row as it visually appears on the statement page, so table rows and section headings each stand on their own line — use that structure to find the transaction listing.
- Most statements have a section literally headed "Transactions" (or "Transaction History", "Account Activity", "Transactions Continued", etc.), usually with a column header line like "Date ... Description ... Amount" right after it. ONLY extract rows from inside that section. Sub-headings inside it that group rows by type (e.g. "Purchases and Adjustments", "Payments and Other Credits", "Deposits", "Withdrawals") are part of the listing and fine to extract from — a "TOTAL ... FOR THIS PERIOD" line right after one of those groups is a subtotal, not a transaction, so skip it.
- Everything outside that section is noise, no matter how much it looks like it belongs — this includes account summaries and payment coupons, legal/interest disclosures (e.g. "IMPORTANT INFORMATION ABOUT THIS ACCOUNT", "CALCULATION OF BALANCES", "Interest Charge Calculation", APR tables), year-to-date fee/interest totals, rewards summaries, and any other marketing or informational block. These sections often contain dates and dollar amounts of their own (APRs, fee totals, cash-back figures) that are NOT transactions — do not extract them even though they look superficially similar to a transaction row.
- ONLY extract rows from inside the transaction listing that clearly have a date, a description/payee, and an amount, laid out as a table row or repeating line-item.
- A row that had extra detail printed under it on the original statement (e.g. a traveler/passenger name and flight itinerary under an airline charge, or a memo line under a purchase) has already been merged onto one line for you, with " | " joining the main row to its detail — e.g. "07/27 07/27 AMERICAN AIR... 345.80 | CHI/HSUAN 08/05 LGA/ORD RNDTRP ORD/LGA". Take the date/description/amount from the part before " | " and treat the part after it as optional extra context — never skip a row just because it has a " | " section attached.
- "When in doubt, skip" applies to lines that might be narrative/legal noise from outside the transaction listing (rule above) — it does NOT mean skipping a row inside the listing just because it looks unusual (e.g. a long merchant string, an odd reference number, or the continuation-line case above). Every line inside the transaction listing that has its own date and amount is a transaction and must be extracted.
- Include ALL debit transactions (money going OUT). Skip credits, deposits, refunds, opening/closing balances, and summary rows.
- For credit card bill payments, credit card autopay, balance transfers, inter-account transfers, loan payments, "payment thank you", "payment received", or any transaction paying off a credit card or moving money between your own accounts — include them but set "isPayment": true.
- For all regular expenses, set "isPayment": false.
- Dates must be in YYYY-MM-DD format.
- Amounts must be positive numbers (no currency symbols, no commas).
- Descriptions should be clean merchant/payee names — strip reference numbers, codes, and noise.
- For category, pick the single best match from: ${categoriesList}. For payment/transfer rows, use "Other".
- If you cannot determine a field with confidence for a genuine transaction row, make a reasonable guess — but never fabricate a row that isn't in the transaction listing.
- Return ONLY a valid JSON array, no explanation or markdown — return [] (not a summary) if this chunk has no transactions to extract.

Merchant category hints (use these as guidance):
- Household: Amazon, Flipkart, Meesho, IKEA, Pepperfry, Urban Ladder, D-Mart, Big Bazaar, Reliance Smart, DMart, Target, Walmart, Costco, Home Depot, Lowe's, Bed Bath & Beyond, Wayfair, Williams-Sonoma, Crate & Barrel
- Food: Swiggy, Zomato, McDonald's, KFC, Domino's, Pizza Hut, Starbucks, Cafe Coffee Day, Subway, Burger King, Chipotle, Dunkin', Panera Bread, Chick-fil-A, Taco Bell, Wendy's, DoorDash, Grubhub, Uber Eats, Instacart
- Groceries: BigBasket, Blinkit, Zepto, Dunzo, JioMart, Spencer's, Nature's Basket, Whole Foods, Trader Joe's, Kroger, Safeway, Publix, Aldi, Sprouts, H-E-B, Wegmans
- Commute/Car: Uber, Ola, Rapido, Metro, BMTC, BEST, FastTag, petrol, fuel, parking, Lyft, EZPass, Shell, BP, Chevron, Exxon, Mobil, Circle K, QuikTrip, SunPass
- Travel: MakeMyTrip, Goibibo, Cleartrip, IndiGo, Air India, SpiceJet, Yatra, IRCTC, Airbnb, OYO, Delta, United, American Airlines, Southwest, JetBlue, Expedia, Booking.com, Hotels.com, Marriott, Hilton, Hyatt
- OTT/Streaming Fees: Netflix, Amazon Prime, Hotstar, Disney+, Spotify, Apple Music, YouTube Premium, JioCinema, SonyLIV, Hulu, HBO Max, Max, Peacock, Paramount+, Apple TV+, Tidal, Pandora
- Internet: Airtel broadband, ACT Fibernet, BSNL broadband, Hathway, JioFiber, Comcast, Xfinity, AT&T, Verizon Fios, Spectrum, Cox, CenturyLink, Google Fiber
- Mobile: Airtel recharge, Jio recharge, Vi recharge, BSNL recharge, Verizon, AT&T, T-Mobile, Mint Mobile, Cricket Wireless, Boost Mobile
- Health: Apollo, Practo, PharmEasy, Netmeds, 1mg, Cult.fit, MedPlus, CVS, Walgreens, Rite Aid, UnitedHealth, Cigna, Aetna, Blue Cross, Kaiser
- Entertainment: BookMyShow, PVR, INOX, Wonderla, AMC Theatres, Regal Cinemas, Cinemark, Live Nation, Ticketmaster, StubHub, Dave & Buster's
- Insurance: LIC, HDFC Life, ICICI Lombard, Star Health, Bajaj Allianz, Max Life, Geico, State Farm, Progressive, Allstate, Liberty Mutual, Farmers, USAA
- Self-development/Learning: Udemy, Coursera, Duolingo, Byju's, Unacademy, LinkedIn Learning, Skillshare, MasterClass, Pluralsight, Khan Academy, Codecademy
- Apparel: Myntra, Ajio, Zara, H&M, Uniqlo, Nike, Adidas, Gap, Old Navy, Banana Republic, Nordstrom, Macy's, TJ Maxx, Levi's, Forever 21, ASOS
- Sports: Decathlon, Nike, Adidas, Under Armour, REI, Dick's Sporting Goods, Planet Fitness, LA Fitness, Equinox, Peloton
- Gifts: Archies, Ferns N Petals, 1800Flowers, FTD, ProFlowers, Etsy, Hallmark

Example output format:
[
  {"date": "2024-01-15", "description": "Swiggy", "amount": 450.00, "category": "Food", "isPayment": false},
  {"date": "2024-01-16", "description": "Uber", "amount": 120.50, "category": "Commute/Car", "isPayment": false},
  {"date": "2024-01-17", "description": "Credit Card Autopay", "amount": 2500.00, "category": "Other", "isPayment": true}
]

Bank statement text:
${text}`;
}

type RawTransaction = { date: string; description: string; amount: number; category: string; isPayment?: boolean };

export function parseResponseText(raw: string): ParsedTransaction[] {
  const json = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();

  // Always log the raw text so a parse failure is diagnosable from the
  // browser console, not just the truncated snippet in the thrown error.
  const logRaw = () => console.error('[llmParser] unparseable LLM response:', raw);
  const snippet = (s: string, n = 300) => (s.length > n ? s.slice(0, n) + '…' : s);

  let parsed: RawTransaction[];
  try {
    parsed = JSON.parse(json) as RawTransaction[];
  } catch {
    // LLM output was likely truncated — recover everything up to the last complete object
    const lastBrace = json.lastIndexOf('}');
    if (lastBrace === -1) {
      logRaw();
      throw new Error(
        `LLM returned no transaction JSON at all — it likely replied with an explanation instead of data. Raw response started with: "${snippet(json || raw)}"`
      );
    }
    try {
      parsed = JSON.parse(json.slice(0, lastBrace + 1) + ']') as RawTransaction[];
    } catch {
      logRaw();
      throw new Error(
        `LLM returned unparseable output even after truncation recovery. Try importing a shorter date range, or check the server console for the full raw response. Ends with: "${snippet(json.slice(-300), 300)}"`
      );
    }
  }

  return parsed.map((t) => ({
    date: t.date,
    description: t.description,
    amount: Math.abs(t.amount),
    category: CATEGORIES.includes(t.category as typeof CATEGORIES[number]) ? t.category : 'Other',
    isPayment: t.isPayment ?? false,
    selected: !(t.isPayment ?? false),
  }));
}

/** Parse bank statement text via the local server proxy.
 *  LLM provider and credentials are configured in .env.local — see .env.local.example. */
export async function parseTransactions(text: string): Promise<ParsedTransaction[]> {
  const prompt = buildPrompt(text);

  let response: Response;
  try {
    response = await fetch('http://localhost:3001/api/llm/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
  } catch {
    throw new Error(
      'Cannot reach the server. Run `npm run dev` to start both the frontend and server.'
    );
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string })?.error ?? `Server error ${response.status}`);
  }

  const { result } = (await response.json()) as { result: string };
  return parseResponseText(result);
}
