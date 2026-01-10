import {
  Category,
  CATEGORY_KEYWORDS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES
} from "../../constants/Categories";

interface ParsedTransaction {
  date: string;
  note: string;
  amount: number;
  type: 'income' | 'expense';
  category: any;
  paymentMethod: string;
  originalSms?: string;
}

interface SmsMessage {
  address: string;
  body: string;
  date: number;
  dateSent?: number;
}


/**
 * Check if an SMS is likely a bank transaction message
 */
export const isBankSms = (sms: SmsMessage): boolean => {
  const { address, body } = sms;
  if (!address || !body) return false;

  // 1. Filter Sender: Must contain letters (Bank headers are alphanumeric like AD-HDFCBK)
  // If it's purely numeric (like a phone number), ignore it.
  if (/^\+?\d+$/.test(address)) return false;

  const lowerBody = body.toLowerCase();

  // 2. Exclude common non-transactional messages
  // We want to avoid OTPs as they are not transactions yet, or just login attempts
  if (
    lowerBody.includes('otp') ||
    lowerBody.includes('login') ||
    lowerBody.includes('verification') ||
    lowerBody.includes('auth code')
  ) {
    return false;
  }

  // 3. Must contain financial keywords
  const keywords = [
    'debited', 'credited', 'spent', 'paid', 'sent', 'received',
    'withdrawn', 'payment', 'transfer', 'txn', 'ac no', 'a/c',
    'purchase', 'refund'
  ];

  return keywords.some(k => lowerBody.includes(k));
};

/**
 * Parse SMS message to extract transaction information
 */
export const parseSmsTransaction = (sms: SmsMessage, userCategories: any[]): ParsedTransaction | null => {
  const body = sms.body || '';
  const address = sms.address || '';

  // 1. Convert entire message to lowercase for consistent matching
  const lowerBody = body.toLowerCase().replace(/\s+/g, ' ').trim();

  // 2. Determine Transaction Type (Income vs Expense)
  // Logic: Scan for keywords. 
  let type: 'income' | 'expense' = 'expense'; // Default
  const isCredit = /credited|received|deposited|refund|cashback|added/i.test(lowerBody);
  const isDebit = /debited|deducted|spent|paid|withdrawn|purchase|sent/i.test(lowerBody);

  if (isCredit && !isDebit) {
    type = 'income';
  } else if (isDebit && !isCredit) {
    type = 'expense';
  } else if (isCredit && isDebit) {
    // Conflict resolution: 'debited' usually wins for spending unless explicit 'credited back'
    type = 'expense';
    if (lowerBody.includes('refund') || lowerBody.includes('credited back')) {
      type = 'income';
    }
  }

  // 3. Extract Amount - FIRST match of "Rs" pattern
  // User Rule: "look for keyword rs if there are more than 1 rs then consider only the first rs"
  let amount: number | null = null;
  const rsRegex = /(?:rs\.?|inr|₹|rs:)\s*([\d,]+(?:\.\d+)?)/;
  const match = lowerBody.match(rsRegex);

  if (match && match[1]) {
    const extractedAmt = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(extractedAmt) && extractedAmt > 0) {
      amount = extractedAmt;
    }
  }

  // Strict: If no amount found via Rs pattern, return null (Ignore account numbers etc)
  if (!amount || amount > 10000000) return null;

  // 4. Extract Merchant (Initial Guess)
  let merchant = extractMerchantName(body, address);

  // 5. Date Extraction (Crucial Fix)
  // Default to SMS timestamp, but override if date string is found in body
  let transactionDate = sms.date ? new Date(sms.date) : new Date();

  // Regex for alphanumeric months: 12-Dec-2025, 12 Dec 25, 12/Dec/2025
  const alphaDateMatch = body.match(/\b(\d{1,2})[-\/\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\/\s](\d{2,4})\b/i);

  // Regex for numeric months: DD-MM-YYYY, DD/MM/YYYY
  const numericDateMatch = body.match(/\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})\b/);

  if (alphaDateMatch) {
    const day = parseInt(alphaDateMatch[1], 10);
    const monthStr = alphaDateMatch[2].toLowerCase();
    let year = parseInt(alphaDateMatch[3], 10);

    const monthMap: { [key: string]: number } = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = monthMap[monthStr];

    if (year < 100) year += 2000;

    const extractedDate = new Date(year, month, day);
    if (!isNaN(extractedDate.getTime())) {
      extractedDate.setHours(12, 0, 0, 0); // Default to noon
      transactionDate = extractedDate;
    }
  } else if (numericDateMatch) {
    const day = parseInt(numericDateMatch[1], 10);
    const month = parseInt(numericDateMatch[2], 10) - 1;
    let year = parseInt(numericDateMatch[3], 10);

    // Handle 2-digit year (e.g. 25 -> 2025)
    if (year < 100) {
      year += 2000;
    }

    const extractedDate = new Date(year, month, day);

    // Validate date
    if (!isNaN(extractedDate.getTime())) {
      // Default to noon to avoid timezone shifting if no time found
      extractedDate.setHours(12, 0, 0, 0);
      transactionDate = extractedDate;
    }
  }

  // Optional: Try to find time in HH:MM format (applies to both cases)
  const timeMatch = body.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
  if (timeMatch) {
    transactionDate.setHours(parseInt(timeMatch[1], 10));
    transactionDate.setMinutes(parseInt(timeMatch[2], 10));
    if (timeMatch[3]) transactionDate.setSeconds(parseInt(timeMatch[3], 10));
  }

  const paymentMethod = detectPaymentMethod(lowerBody);

  // 6. Category - Using explicit keyword matching from Categories.ts
  // Now returns { category, matchedKeyword }
  const { category, matchedKeyword } = findOrGenerateCategory(merchant, lowerBody, userCategories, type === 'income');

  // 7. Update Note (Merchant) if a keyword was matched
  if (matchedKeyword) {
    // Capitalize first letter
    merchant = matchedKeyword.charAt(0).toUpperCase() + matchedKeyword.slice(1);
  }

  return {
    date: transactionDate.toISOString(),
    note: merchant,
    amount: amount,
    type: type,
    category: category,
    paymentMethod: paymentMethod,
    originalSms: body
  };
};

/**
 * Extract merchant name from SMS body
 */
const extractMerchantName = (body: string, address: string): string => {
  let merchant = '';
  // Try to keep original casing, but for matching use lower
  const lower = body.toLowerCase();

  // UPI merchant patterns
  const upiMatch = body.match(/(?:UPI|to|at)\s+([A-Za-z0-9\s]+?)(?:\s+on|\s+via|\s+using|$)/i);
  if (upiMatch && upiMatch[1]) {
    merchant = upiMatch[1].trim();
  }

  // POS patterns
  const posMatch = body.match(/POS\s+(?:at\s+)?([A-Za-z0-9\s]+?)(?:\s+on|\s+via|$)/i);
  if (posMatch && posMatch[1]) {
    merchant = posMatch[1].trim();
  }

  // ATM patterns
  const atmMatch = body.match(/ATM\s+(?:at\s+)?([A-Za-z0-9\s]+?)(?:\s+on|$)/i);
  if (atmMatch && atmMatch[1]) {
    merchant = `ATM - ${atmMatch[1].trim()}`;
  }

  // Fallback extraction
  if (!merchant) {
    let clean = body
      .replace(/(?:rs\.?|inr|₹|rs:)[\s:]*[\d,.]+/gi, '') // Remove amount
      .replace(/debited|credited|paid|received|spent/gi, '')
      .replace(/account|a\/c|ac no|xx\d+/gi, '')
      .replace(/balance|bal|avbl/gi, '')
      .replace(/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/gi, '') // Date
      .replace(/ref\s+no[:\s]+[\w\d]+/gi, '')
      .trim();

    // Split and take first few words
    const words = clean.split(/\s+/).filter(w => w.length > 2 && !/^\d+$/.test(w));
    merchant = words.slice(0, 3).join(' ') || 'Transaction';
  }

  return merchant.replace(/[^\w\s-]/g, '').trim().substring(0, 50) || 'Transaction';
};

/**
 * Detect payment method
 */
const detectPaymentMethod = (body: string): string => {
  const lower = body.toLowerCase();
  if (lower.includes('upi')) return 'UPI';
  if (lower.includes('atm') || lower.includes('cash')) return 'Cash';
  if (lower.includes('neft') || lower.includes('imps') || lower.includes('rtgs')) return 'Transfer';
  if (lower.includes('pos') || lower.includes('card')) return 'Card';
  if (lower.includes('netbanking') || lower.includes('net banking')) return 'Online';
  return 'Online';
};

/**
 * Find or generate category matching keywords from Categories.ts
 */
const findOrGenerateCategory = (
  merchant: string,
  lowerBody: string, // Already lowercased
  userCategories: any[],
  isIncome: boolean
): { category: Category; matchedKeyword: string | null } => {
  const fullText = (merchant + ' ' + lowerBody).toLowerCase();
  const categoriesToCreate: Category[] = [];
  const getCurrentPool = () => [...userCategories, ...categoriesToCreate];

  // Helper to find existing
  const findExisting = (lbl: string) => getCurrentPool().find(c => c.label.toLowerCase() === lbl.toLowerCase());

  // 1. Check CATEGORY_KEYWORDS (from Categories.ts)
  for (const [standardLabel, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    // Check if any keyword matches
    // We search for the keyword and return it if found
    const match = keywords.find(k => fullText.includes(k.toLowerCase()));

    if (match) {
      const existing = findExisting(standardLabel);
      if (existing) return { category: existing, matchedKeyword: match };
      const newCat = createCategoryIfMissing(standardLabel, getCurrentPool(), categoriesToCreate);
      return { category: newCat, matchedKeyword: match };
    }
  }

  // 2. Check Default Category Labels directly (e.g. if text says "Groceries" or "Rent")
  const defaults = isIncome ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  for (const defCat of defaults) {
    if (fullText.includes(defCat.label.toLowerCase())) {
      const cat = findExisting(defCat.label) || createCategoryIfMissing(defCat.label, getCurrentPool(), categoriesToCreate);
      return { category: cat, matchedKeyword: defCat.label };
    }
  }

  // 3. Fallback to user's existing category labels
  const directMatch = getCurrentPool().find(c => fullText.includes(c.label.toLowerCase()));
  if (directMatch) return { category: directMatch, matchedKeyword: directMatch.label };

  // 4. Specific Income/Investment logic if not caught above
  if (isIncome) {
    if (fullText.match(/\b(salary|credit|interest|reward)\b/)) {
      const cat = findExisting("Paycheck") || createCategoryIfMissing("Paycheck", getCurrentPool(), categoriesToCreate);
      return { category: cat, matchedKeyword: "Salary/Credit" };
    }
    const cat = findExisting("General") || createCategoryIfMissing("General", getCurrentPool(), categoriesToCreate);
    return { category: cat, matchedKeyword: null };
  }

  if (fullText.match(/\b(investment|stock|equity)\b/)) {
    const cat = findExisting("Investments") || createCategoryIfMissing("Investments", getCurrentPool(), categoriesToCreate);
    return { category: cat, matchedKeyword: "Investment" };
  }

  // 5. Final Fallback
  const finalCat = findExisting("General") || createCategoryIfMissing("General", getCurrentPool(), categoriesToCreate);
  return { category: finalCat, matchedKeyword: null };
};

const createCategoryIfMissing = (label: string, currentPool: any[], queue: any[]): Category => {
  const exists = currentPool.find(c => c.label.trim().toLowerCase() === label.toLowerCase());
  if (exists) return exists;

  const defaultStyle =
    DEFAULT_EXPENSE_CATEGORIES.find(c => c.label === label) ||
    DEFAULT_INCOME_CATEGORIES.find(c => c.label === label) ||
    { emoji: '🧾', color: '#9ca3af' };

  const newCat: Category = {
    id: Date.now().toString() + Math.floor(Math.random() * 1000),
    label: label,
    emoji: defaultStyle.emoji,
    color: defaultStyle.color,
    isCustom: false
  };

  queue.push(newCat);
  return newCat;
};
