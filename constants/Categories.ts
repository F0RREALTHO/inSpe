
export type Category = {
  id: string;
  emoji: string;
  label: string;
  color: string;
  isCustom: boolean;
};

export const DEFAULT_EXPENSE_CATEGORIES: Category[] = [
  { id: '1', emoji: '🍔', label: 'Food', color: '#3b82f6', isCustom: false },
  { id: '2', emoji: '🚆', label: 'Transport', color: '#64748b', isCustom: false },
  { id: '3', emoji: '🏠', label: 'Rent', color: '#f59e0b', isCustom: false },
  { id: '4', emoji: '🔄', label: 'Subscriptions', color: '#0ea5e9', isCustom: false },
  { id: '5', emoji: '🛒', label: 'Groceries', color: '#10b981', isCustom: false },
  { id: '6', emoji: '👥', label: 'Family', color: '#8b5cf6', isCustom: false },
  { id: '7', emoji: '💡', label: 'Utilities', color: '#eab308', isCustom: false },
  { id: '8', emoji: '👔', label: 'Fashion', color: '#06b6d4', isCustom: false },
  { id: '9', emoji: '🚑', label: 'Healthcare', color: '#ef4444', isCustom: false },
  { id: '10', emoji: '🐕', label: 'Pets', color: '#a8a29e', isCustom: false },
  { id: '11', emoji: '👟', label: 'Sneakers', color: '#6366f1', isCustom: false },
  { id: '12', emoji: '🎁', label: 'Gifts', color: '#f43f5e', isCustom: false },
];

export const DEFAULT_INCOME_CATEGORIES: Category[] = [
  { id: '101', emoji: '💰', label: 'Paycheck', color: '#22c55e', isCustom: false },
  { id: '102', emoji: '🤑', label: 'Allowance', color: '#f59e0b', isCustom: false },
  { id: '103', emoji: '💼', label: 'Part-Time', color: '#8b5cf6', isCustom: false },
  { id: '104', emoji: '📈', label: 'Investments', color: '#10b981', isCustom: false },
  { id: '105', emoji: '🧧', label: 'Gifts', color: '#f43f5e', isCustom: false },
  { id: '106', emoji: '🪙', label: 'Tips', color: '#a8a29e', isCustom: false },
];

export const CATEGORY_KEYWORDS: { [key: string]: string[] } = {
  "Food": ["swiggy", "zomato", "dominos", "pizzahut", "kfc", "burger", "subway", "starbucks", "cafe", "tea", "coffee", "restaurant", "dining", "bar", "pub", "kitchen", "baker", "cake", "mcdonalds", "biryani", "juice", "sweet", "chaayos", "third wave", "blue tokai", "eatclub"],
  "Transport": ["uber", "ola", "rapido", "petrol", "fuel", "shell", "hpcl", "bpcl", "iocl", "metro", "railway", "irctc", "flight", "bus", "fastag", "toll", "parking", "indigo", "air india", "vistara", "auto", "cab", "yulu", "bounce"],
  "Groceries": ["blinkit", "zepto", "instamart", "bigbasket", "dmart", "reliance smart", "milk", "dairy", "vegetable", "fruit", "grocery", "kirana", "supermarket", "nature's basket", "spencer", "more retail", "luce"],
  "Utilities": ["jio", "airtel", "vi", "vodafone", "bescom", "electricity", "power", "gas", "water", "bill", "broadband", "act fibernet", "recharge", "dth", "tatasky", "dishtv", "bsnl", "mtnl", "cylinder", "indane", "bharatgas"],
  "Healthcare": ["apollo", "pharmacy", "medplus", "hospital", "clinic", "doctor", "lab", "scan", "mri", "health", "medicine", "1mg", "pharmeasy", "practo", "cult.fit", "gym", "fitness"],
  "Investments": ["zerodha", "groww", "upstox", "sip", "mutual fund", "stock", "equity", "nps", "ppf", "indmoney", "smallcase", "coin", "kite", "angel one"],
  "Fashion": ["myntra", "ajio", "zudio", "decathlon", "fashion", "cloth", "zara", "h&m", "trends", "max", "pantaloons", "uniqlo", "levi", "nike", "adidas", "puma", "westside", "lifestyle"],
  "Subscriptions": ["netflix", "prime", "hotstar", "spotify", "youtube", "apple", "subscription", "sonyliv", "zee5", "hulu", "chatgpt", "midjourney", "claude", "linkedin"],
  "Shopping": ["amazon", "flipkart", "meesho", "nykaa", "tatacliq", "mall", "retail", "croma", "reliance digital", "vijay sales", "apple store", "samsung"]
};