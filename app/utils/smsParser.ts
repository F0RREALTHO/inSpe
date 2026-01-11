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


export const isBankSms = (sms: SmsMessage): boolean => {
  const { address, body } = sms;
  if (!address || !body) return false;

  if (/^\+?\d+$/.test(address)) return false;

  const lowerBody = body.toLowerCase();

  if (
    lowerBody.includes('otp') ||
    lowerBody.includes('login') ||
    lowerBody.includes('verification') ||
    lowerBody.includes('auth code')
  ) {
    return false;
  }

  const keywords = [
    'debited', 'credited', 'spent', 'paid', 'sent', 'received',
    'withdrawn', 'payment', 'transfer', 'txn', 'ac no', 'a/c',
    'purchase', 'refund'
  ];

  return keywords.some(k => lowerBody.includes(k));
};

export const parseSmsTransaction = (sms: SmsMessage, userCategories: any[]): ParsedTransaction | null => {
  const body = sms.body || '';
  const address = sms.address || '';

  const lowerBody = body.toLowerCase().replace(/\s+/g, ' ').trim();

  let type: 'income' | 'expense' = 'expense'; // Default
  const isCredit = /credited|received|deposited|refund|cashback|added/i.test(lowerBody);
  const isDebit = /debited|deducted|spent|paid|withdrawn|purchase|sent/i.test(lowerBody);

  if (isCredit && !isDebit) {
    type = 'income';
  } else if (isDebit && !isCredit) {
    type = 'expense';
  } else if (isCredit && isDebit) {
    type = 'expense';
    if (lowerBody.includes('refund') || lowerBody.includes('credited back')) {
      type = 'income';
    }
  }

  let amount: number | null = null;
  const rsRegex = /(?:rs\.?|inr|₹|rs:)\s*([\d,]+(?:\.\d+)?)/;
  const match = lowerBody.match(rsRegex);

  if (match && match[1]) {
    const extractedAmt = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(extractedAmt) && extractedAmt > 0) {
      amount = extractedAmt;
    }
  }

  if (!amount || amount > 10000000) return null;

  let merchant = extractMerchantName(body, address);

  let transactionDate = sms.date ? new Date(sms.date) : new Date();

  const alphaDateMatch = body.match(/\b(\d{1,2})[-\/\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\/\s](\d{2,4})\b/i);

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
      extractedDate.setHours(12, 0, 0, 0);
      transactionDate = extractedDate;
    }
  } else if (numericDateMatch) {
    const day = parseInt(numericDateMatch[1], 10);
    const month = parseInt(numericDateMatch[2], 10) - 1;
    let year = parseInt(numericDateMatch[3], 10);

    if (year < 100) {
      year += 2000;
    }

    const extractedDate = new Date(year, month, day);

    if (!isNaN(extractedDate.getTime())) {
      extractedDate.setHours(12, 0, 0, 0);
      transactionDate = extractedDate;
    }
  }

  const timeMatch = body.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
  if (timeMatch) {
    transactionDate.setHours(parseInt(timeMatch[1], 10));
    transactionDate.setMinutes(parseInt(timeMatch[2], 10));
    if (timeMatch[3]) transactionDate.setSeconds(parseInt(timeMatch[3], 10));
  }

  const paymentMethod = detectPaymentMethod(lowerBody);

  const { category, matchedKeyword } = findOrGenerateCategory(merchant, lowerBody, userCategories, type === 'income');

  if (matchedKeyword) {
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

const extractMerchantName = (body: string, address: string): string => {
  let merchant = '';
  const lower = body.toLowerCase();

  const upiMatch = body.match(/(?:UPI|to|at)\s+([A-Za-z0-9\s]+?)(?:\s+on|\s+via|\s+using|$)/i);
  if (upiMatch && upiMatch[1]) {
    merchant = upiMatch[1].trim();
  }

  const posMatch = body.match(/POS\s+(?:at\s+)?([A-Za-z0-9\s]+?)(?:\s+on|\s+via|$)/i);
  if (posMatch && posMatch[1]) {
    merchant = posMatch[1].trim();
  }

  const atmMatch = body.match(/ATM\s+(?:at\s+)?([A-Za-z0-9\s]+?)(?:\s+on|$)/i);
  if (atmMatch && atmMatch[1]) {
    merchant = `ATM - ${atmMatch[1].trim()}`;
  }

  if (!merchant) {
    let clean = body
      .replace(/(?:rs\.?|inr|₹|rs:)[\s:]*[\d,.]+/gi, '')
      .replace(/debited|credited|paid|received|spent/gi, '')
      .replace(/account|a\/c|ac no|xx\d+/gi, '')
      .replace(/balance|bal|avbl/gi, '')
      .replace(/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/gi, '')
      .replace(/ref\s+no[:\s]+[\w\d]+/gi, '')
      .trim();

    const words = clean.split(/\s+/).filter(w => w.length > 2 && !/^\d+$/.test(w));
    merchant = words.slice(0, 3).join(' ') || 'Transaction';
  }

  return merchant.replace(/[^\w\s-]/g, '').trim().substring(0, 50) || 'Transaction';
};

const detectPaymentMethod = (body: string): string => {
  const lower = body.toLowerCase();
  if (lower.includes('upi')) return 'UPI';
  if (lower.includes('atm') || lower.includes('cash')) return 'Cash';
  if (lower.includes('neft') || lower.includes('imps') || lower.includes('rtgs')) return 'Transfer';
  if (lower.includes('pos') || lower.includes('card')) return 'Card';
  if (lower.includes('netbanking') || lower.includes('net banking')) return 'Online';
  return 'Online';
};


const findOrGenerateCategory = (
  merchant: string,
  lowerBody: string,
  userCategories: any[],
  isIncome: boolean
): { category: Category; matchedKeyword: string | null } => {
  const fullText = (merchant + ' ' + lowerBody).toLowerCase();
  const categoriesToCreate: Category[] = [];
  const getCurrentPool = () => [...userCategories, ...categoriesToCreate];

  const findExisting = (lbl: string) => getCurrentPool().find(c => c.label.toLowerCase() === lbl.toLowerCase());

  for (const [standardLabel, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const match = keywords.find(k => fullText.includes(k.toLowerCase()));

    if (match) {
      const existing = findExisting(standardLabel);
      if (existing) return { category: existing, matchedKeyword: match };
      const newCat = createCategoryIfMissing(standardLabel, getCurrentPool(), categoriesToCreate);
      return { category: newCat, matchedKeyword: match };
    }
  }

  const defaults = isIncome ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  for (const defCat of defaults) {
    if (fullText.includes(defCat.label.toLowerCase())) {
      const cat = findExisting(defCat.label) || createCategoryIfMissing(defCat.label, getCurrentPool(), categoriesToCreate);
      return { category: cat, matchedKeyword: defCat.label };
    }
  }

  const directMatch = getCurrentPool().find(c => fullText.includes(c.label.toLowerCase()));
  if (directMatch) return { category: directMatch, matchedKeyword: directMatch.label };

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
