import { Category, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "../../constants/Categories";

interface CSVTransaction {
  date: string;
  note: string;
  amount: number;
  type: 'income' | 'expense';
  categoryLabel: string;
  paymentMethod: string;
}

export const CsvService = {
  /**
   * Generates a CSV string from a list of transactions
   */
  generateCSV: (transactions: any[]): string => {
    // Header
    const header = "Date,Note,Amount,Type,Category,PaymentMethod\n";

    // Rows
    const rows = transactions.map(t => {
      const date = new Date(t.date).toLocaleDateString('en-GB'); // DD/MM/YYYY
      const note = `"${(t.note || '').replace(/"/g, '""')}"`; // Escape quotes
      const amount = t.amount;
      const type = t.type || 'expense';
      const category = `"${(t.category?.label || 'General').replace(/"/g, '""')}"`;
      const method = t.paymentMethod || 'Cash';
      
      return `${date},${note},${amount},${type},${category},${method}`;
    }).join("\n");

    return header + rows;
  },

  /**
   * Parses a CSV string into transaction objects
   * Expected format: Date, Note, Amount, Type, Category, PaymentMethod (optional)
   * Date format supported: DD/MM/YYYY, YYYY-MM-DD
   */
  parseCSV: (csvString: string, userCategories: Category[]): { transactions: any[], newCategories: Category[] } => {
    const lines = csvString.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) throw new Error("CSV file is empty or invalid.");

    const transactions: any[] = [];
    const categoriesToCreate: Category[] = [];
    const getCurrentPool = () => [...userCategories, ...categoriesToCreate];

    // Detect if first row is header
    let startIndex = 0;
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes("date") && firstLine.includes("amount")) {
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      // Split by comma, respecting quotes
      const row = parseCSVLine(lines[i]);
      if (row.length < 3) continue; // Need at least Date, Note, Amount

      // Map columns (assuming standard order: Date, Note, Amount, Type, Category, Method)
      // If user provided fewer, we try to guess or use defaults.
      
      const dateStr = row[0]?.trim();
      const note = row[1]?.trim() || "Imported Transaction";
      const amountStr = row[2]?.replace(/[^\d.]/g, ''); // Clean currency symbols
      const typeStr = row[3]?.trim().toLowerCase();
      const categoryLabel = row[4]?.trim() || "General";
      const method = row[5]?.trim() || "Cash";

      if (!dateStr || !amountStr) continue;

      const dateObj = parseDate(dateStr);
      const amount = parseFloat(amountStr);
      const type = (typeStr === 'income' || typeStr === 'credit') ? 'income' : 'expense';

      // Find or Create Category
      let category = getCurrentPool().find(c => c.label.toLowerCase() === categoryLabel.toLowerCase());
      
      if (!category) {
        // Create new category if not found
        category = createCategory(categoryLabel, type === 'income', categoriesToCreate);
      }

      transactions.push({
        date: dateObj.toISOString(),
        note: note,
        amount: amount,
        type: type,
        category: category,
        paymentMethod: method,
        createdAt: new Date().toISOString(),
        recurring: 'none'
      });
    }

    return { transactions, newCategories: categoriesToCreate };
  }
};

/**
 * Helper to split CSV line respecting quotes
 */
const parseCSVLine = (text: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i+1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

const parseDate = (dateStr: string): Date => {
  // Try ISO YYYY-MM-DD
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) return new Date(dateStr);

  // Try DD/MM/YYYY
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    let year = parseInt(parts[2]);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  return new Date(); // Fallback
};

const createCategory = (label: string, isIncome: boolean, queue: Category[]): Category => {
  const defaults = isIncome ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  const defaultStyle = defaults.find(d => d.label === label) || { emoji: '📂', color: '#9ca3af' };
  
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
