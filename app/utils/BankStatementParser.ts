import { 
  CATEGORY_KEYWORDS, 
  DEFAULT_EXPENSE_CATEGORIES, 
  DEFAULT_INCOME_CATEGORIES,
  Category 
} from "../../constants/Categories";
import { AICategorizationService } from "./AICategorizationService";
import { RateLimiter } from "./Security";

interface Transaction {
  date: string;
  originalDateObj: Date;
  note: string;
  amount: number;
  type: 'income' | 'expense';
  balance: number;
  category: any;
  paymentMethod: string;
  originalRaw?: string;
}

export const processBankText = async (text: string, userCategories: any[]) => {
  console.log("--- STRICT PARSE STARTED ---");

  // Rate Check: Max 1 PDF every 3 minutes
  await RateLimiter.checkLimit("PDF_UPLOAD");
  
  const lines = text.split('\n');
  let rawTransactions: any[] = [];
  
  const categoriesToCreate: Category[] = [];
  const getCurrentPool = () => [...userCategories, ...categoriesToCreate];

  const universalRegex = /(\d{1,2}[-\/.]\w+[-\/.]\d{2,4}).*?([\d,]+\.\d{1,2}(?:\s*\(?[DC]r\)?)?)\s*$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.toLowerCase().includes("opening balance")) continue;

    let match = line.match(universalRegex);
    
    if (!match) {
        const dateMatch = line.match(/(\d{1,2}[-\/.]\w+[-\/.]\d{2,4})/);
        const nextLine = lines[i+1] ? lines[i+1].trim() : "";
        const balanceMatch = nextLine.match(/([\d,]+\.\d{1,2}(?:\s*\(?[DC]r\)?)?)\s*$/i);

        if (dateMatch && balanceMatch) {
            match = (line + " " + nextLine).match(universalRegex);
            i++; 
        }
    }

    if (match) {
        const dateStr = match[1];
        const balanceStr = match[2];
        let rawDesc = match[0].replace(dateStr, '').replace(balanceStr, '').trim();
        
        const intermediateNumbers = rawDesc.match(/([\d,]+\.\d{1,2}(?:\s*\(?[DC]r\)?)?)/g);
        if (intermediateNumbers) {
            intermediateNumbers.forEach(num => { rawDesc = rawDesc.replace(num, ''); });
        }

        const cleanDesc = extractMerchantName(rawDesc);
        const cleanBalanceStr = balanceStr.replace(/[,()]/g, '').replace(/Cr|Dr/gi, '').trim();
        let balance = parseFloat(cleanBalanceStr);
        if (balanceStr.toLowerCase().includes('dr')) balance = -balance;

        if (cleanDesc.length > 1) {
            rawTransactions.push({
                date: dateStr,
                originalDateObj: parseDate(dateStr),
                note: cleanDesc, 
                balance: balance,
                originalRaw: rawDesc 
            });
        }
    }
  }

  rawTransactions.sort((a, b) => a.originalDateObj.getTime() - b.originalDateObj.getTime());

  const finalTransactions: Transaction[] = [];

  // Identify uncertain transactions for AI processing
  const uncertainTransactions: { index: number, desc: string, amount: number }[] = [];

  for (let i = 1; i < rawTransactions.length; i++) {
      const prev = rawTransactions[i - 1];
      const curr = rawTransactions[i];
      const diff = curr.balance - prev.balance;
      
      if (Math.abs(diff) < 0.01) continue;

      const isIncome = diff > 0;
      
      const matchedCategory = findOrGenerateCategory(
          curr.note, 
          curr.originalRaw, 
          getCurrentPool(),
          categoriesToCreate,
          isIncome
      );

      // If matched category is General, flag for AI review
      const isGeneral = matchedCategory.label === "General";
      if (isGeneral) {
          uncertainTransactions.push({ 
              index: finalTransactions.length, // Current position in final array
              desc: curr.note, 
              amount: parseFloat(Math.abs(diff).toFixed(2)) 
          });
      }

      finalTransactions.push({
          date: curr.date,
          originalDateObj: curr.originalDateObj,
          note: curr.note,
          amount: parseFloat(Math.abs(diff).toFixed(2)),
          type: isIncome ? 'income' : 'expense',
          balance: curr.balance,
          category: matchedCategory, 
          paymentMethod: detectPaymentMethod(curr.originalRaw)
      });
  }

  // AI BATCH PROCESSING
  if (uncertainTransactions.length > 0) {
      console.log(`Sending ${uncertainTransactions.length} transactions to AI for categorization...`);
      const inputs = uncertainTransactions.map(t => ({ description: t.desc, amount: t.amount }));
      
      // We process all, though in batches ideally. For now, simple single batch call as the list likely isn't huge.
      // If list is huge (>20), we might want to slice it, but let's trust the batch function handles basic logic.
      // Actually, AICategorizationService.predictCategoriesBatch expects array, let's just send it.
      
      const predictedLabels = await AICategorizationService.predictCategoriesBatch(inputs, getCurrentPool());

      // Update finalTransactions with AI results
      uncertainTransactions.forEach((t, idx) => {
          const predictedLabel = predictedLabels[idx];
          if (predictedLabel && predictedLabel !== "General") {
              const cat = findInPoolOrFallback(getCurrentPool(), predictedLabel);
              if (cat) {
                  finalTransactions[t.index].category = cat;
              }
          }
      });
  }

  return { 
      transactions: finalTransactions.sort((a, b) => b.originalDateObj.getTime() - a.originalDateObj.getTime()),
      newCategories: categoriesToCreate 
  };
};

const findOrGenerateCategory = (
    name: string, 
    raw: string, 
    currentPool: any[], 
    categoriesToCreate: any[],
    isIncome: boolean
) => {
    const fullText = (name + " " + raw).toLowerCase();

    if (fullText.match(/\b(zerodha|groww|mutual|fund|stock|equity|sip)\b/)) {
        return findInPoolOrFallback(currentPool, "Investments") || 
               createCategoryIfMissing("Investments", currentPool, categoriesToCreate);
    }

    if (isIncome) {
        if (fullText.match(/\b(salary|credit|interest|refund)\b/)) {
             return findInPoolOrFallback(currentPool, "Paycheck") || 
                    createCategoryIfMissing("Paycheck", currentPool, categoriesToCreate);
        }
        return findInPoolOrFallback(currentPool, "Allowance") || 
               findInPoolOrFallback(currentPool, "General") || 
               createCategoryIfMissing("General", currentPool, categoriesToCreate);
    }

    for (const [standardLabel, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        const regexPattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'i');
        
        if (regexPattern.test(fullText)) {
            const match = currentPool.find(c => c.label.trim().toLowerCase() === standardLabel.toLowerCase());
            if (match) return match;
            return createCategoryIfMissing(standardLabel, currentPool, categoriesToCreate);
        }
    }

    if (fullText.match(/\b(neft|imps|rtgs|transfer|upi|paytm|gpay|phonepe|bharatpe)\b/)) {
        return findInPoolOrFallback(currentPool, "General") || 
               createCategoryIfMissing("General", currentPool, categoriesToCreate);
    }

    const directMatch = currentPool.find(c => fullText.includes(c.label.toLowerCase()));
    if (directMatch) return directMatch;

    return findInPoolOrFallback(currentPool, "General") || 
           createCategoryIfMissing("General", currentPool, categoriesToCreate);
};

const findInPoolOrFallback = (pool: any[], label: string) => {
    return pool.find(c => c.label.trim().toLowerCase() === label.toLowerCase());
};

const createCategoryIfMissing = (label: string, currentPool: any[], queue: any[]) => {
    const exists = currentPool.find(c => c.label.trim().toLowerCase() === label.toLowerCase());
    if (exists) return exists;

    const defaultStyle = 
        DEFAULT_EXPENSE_CATEGORIES.find(c => c.label === label) || 
        DEFAULT_INCOME_CATEGORIES.find(c => c.label === label) ||
        { emoji: '🧾', color: '#9ca3af' }; // Default Grey for General

    const newCat = {
        id: Date.now().toString() + Math.floor(Math.random() * 1000),
        label: label,
        emoji: defaultStyle.emoji,
        color: defaultStyle.color,
        isCustom: false
    };

    queue.push(newCat);
    return newCat;
};

const extractMerchantName = (raw: string): string => {
    let clean = raw;
    const upiMatch = clean.match(/(?:UPI|IPS|MMT|IMPS)(?:.*?\/){3}(.*?)\//i);
    if (upiMatch && upiMatch[1]) return toTitleCase(upiMatch[1].replace(/_/g, ' '));
    const neftMatch = clean.match(/NEFT[-:][\w]+[-:](.*?)[-:]/i);
    if (neftMatch && neftMatch[1]) return toTitleCase(neftMatch[1]);
    const posMatch = clean.match(/POS[\s:]+(.*?)(?:\/|$)/i);
    if (posMatch && posMatch[1]) return toTitleCase(posMatch[1]);
    
    clean = clean
        .replace(/UPIAR\/|UPIAB\/|UPIRR\/|CR\/|DR\//g, " ")
        .replace(/\d{10,}/g, "")
        .replace(/[A-Z]{4}0[A-Z0-9]{6}/g, "") 
        .replace(/\b(UTIB|ICIC|HDFC|SBIN|BARB|BKID|YESB)\b/g, "") 
        .replace(/[\/\\]/g, " ")
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, "")
        .trim();
        
    return toTitleCase(clean.substring(0, 25));
};

const toTitleCase = (str: string) => {
    return str.toLowerCase().replace(/(?:^|\s)\w/g, match => match.toUpperCase());
};

const parseDate = (dateStr: string): Date => {
    let cleanDate = dateStr.replace(/[-.]/g, '/');
    const parts = cleanDate.split('/');
    let day = parseInt(parts[0]);
    let month = 0;
    let year = parseInt(parts[2]);
    if (year < 100) year += 2000;
    if (isNaN(parseInt(parts[1]))) {
        const months: any = {'jan':0,'feb':1,'mar':2,'apr':3,'may':4,'jun':5,'jul':6,'aug':7,'sep':8,'oct':9,'nov':10,'dec':11};
        month = months[parts[1].toLowerCase().substring(0, 3)] || 0;
    } else {
        month = parseInt(parts[1]) - 1;
    }
    return new Date(year, month, day); 
};

const detectPaymentMethod = (desc: string): string => {
    const lower = desc.toLowerCase();
    if (lower.includes("upi")) return "UPI";
    if (lower.includes("atm") || lower.includes("cash")) return "Cash";
    if (lower.includes("neft") || lower.includes("imps") || lower.includes("rtgs")) return "Transfer";
    if (lower.includes("pos") || lower.includes("card")) return "Card";
    return "Online";
};