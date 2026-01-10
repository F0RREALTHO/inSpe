// Utility for computing detailed insights metrics

export interface MonthComparison {
  currentMonth: { income: number; expense: number; net: number };
  lastMonth: { income: number; expense: number; net: number };
  expenseChange: number; // percentage change
  incomeChange: number;
  trend: 'up' | 'down' | 'same';
}

export interface BestSavingDay {
  date: string;
  dayName: string;
  spent: number;
}

export interface BiggestExpense {
  label: string;
  amount: number;
  category: string;
  color: string;
  percentOfTotal: number;
}

export interface BurnRatePrediction {
  currentSpending: number;
  dailyAverage: number;
  daysLeftInMonth: number;
  projectedTotal: number;
  monthlyLimit: number;
  willExceed: boolean;
  excessAmount: number;
}

export interface CategoryAlert {
  category: string;
  message: string;
  type: 'increase' | 'highest' | 'unusual';
  changePercent: number;
  color: string;
}

// 1️⃣ MONTH OVER MONTH COMPARISON
export const calculateMonthComparison = (transactions: any[]): MonthComparison => {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const currentMonthTxs = transactions.filter(t => new Date(t.date) >= currentMonthStart);
  const lastMonthTxs = transactions.filter(
    t => new Date(t.date) >= lastMonthStart && new Date(t.date) <= lastMonthEnd
  );

  const getStats = (txs: any[]) => ({
    income: txs.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0),
    expense: txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0),
  });

  const currentStats = getStats(currentMonthTxs);
  const lastStats = getStats(lastMonthTxs);

  const expenseChange = lastStats.expense > 0 
    ? ((currentStats.expense - lastStats.expense) / lastStats.expense) * 100 
    : 0;
  const incomeChange = lastStats.income > 0 
    ? ((currentStats.income - lastStats.income) / lastStats.income) * 100 
    : 0;

  return {
    currentMonth: { ...currentStats, net: currentStats.income - currentStats.expense },
    lastMonth: { ...lastStats, net: lastStats.income - lastStats.expense },
    expenseChange,
    incomeChange,
    trend: expenseChange < -5 ? 'down' : expenseChange > 5 ? 'up' : 'same',
  };
};

// 2️⃣ BIGGEST EXPENSE
export const getBiggestExpense = (transactions: any[]): BiggestExpense | null => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTxs = transactions.filter(
    t => t.type === 'expense' && new Date(t.date) >= monthStart
  );

  if (monthTxs.length === 0) return null;

  const biggest = monthTxs.reduce((prev, current) => 
    Number(current.amount) > Number(prev.amount) ? current : prev
  );

  const totalExpense = monthTxs.reduce((sum, t) => sum + Number(t.amount), 0);
  const percentOfTotal = (Number(biggest.amount) / totalExpense) * 100;

  return {
    label: biggest.description || 'Unnamed',
    amount: Number(biggest.amount),
    category: biggest.category?.label || 'Other',
    color: biggest.category?.color || '#888',
    percentOfTotal,
  };
};

// 3️⃣ BEST SAVING DAY
export const getBestSavingDay = (transactions: any[]): BestSavingDay | null => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTxs = transactions.filter(
    t => t.type === 'expense' && new Date(t.date) >= monthStart
  );

  if (monthTxs.length === 0) return null;

  const dailySpending: Record<string, number> = {};
  monthTxs.forEach(t => {
    const date = new Date(t.date).toISOString().split('T')[0];
    dailySpending[date] = (dailySpending[date] || 0) + Number(t.amount);
  });

  const [bestDate, spent] = Object.entries(dailySpending).reduce((prev, current) =>
    current[1] < prev[1] ? current : prev
  );

  const dateObj = new Date(bestDate + 'T00:00:00');
  const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'short' });

  return {
    date: bestDate,
    dayName,
    spent,
  };
};

// 4️⃣ BURN RATE PREDICTION (AI ONLY)
export const calculateBurnRate = (
  transactions: any[],
  monthlyLimit: number
): BurnRatePrediction => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const dayOfMonth = now.getDate();

  const monthTxs = transactions.filter(
    t => t.type === 'expense' && new Date(t.date) >= monthStart
  );

  const currentSpending = monthTxs.reduce((sum, t) => sum + Number(t.amount), 0);
  const dailyAverage = dayOfMonth > 0 ? currentSpending / dayOfMonth : 0;
  const daysLeftInMonth = daysInMonth - dayOfMonth;
  const projectedTotal = currentSpending + (dailyAverage * daysLeftInMonth);
  const willExceed = projectedTotal > monthlyLimit;
  const excessAmount = willExceed ? projectedTotal - monthlyLimit : 0;

  return {
    currentSpending,
    dailyAverage,
    daysLeftInMonth,
    projectedTotal,
    monthlyLimit,
    willExceed,
    excessAmount,
  };
};

// 5️⃣ CATEGORY ALERTS (AI ONLY)
export const getCategoryAlerts = (
  transactions: any[],
  categoryBudgets?: Record<string, number>
): CategoryAlert[] => {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const currentMonthTxs = transactions.filter(
    t => t.type === 'expense' && new Date(t.date) >= currentMonthStart
  );
  const lastMonthTxs = transactions.filter(
    t => t.type === 'expense' && new Date(t.date) >= lastMonthStart && new Date(t.date) <= lastMonthEnd
  );

  const getCategorySpending = (txs: any[]) => {
    const catMap: Record<string, number> = {};
    txs.forEach(t => {
      const cat = t.category?.label || 'Other';
      catMap[cat] = (catMap[cat] || 0) + Number(t.amount);
    });
    return catMap;
  };

  const currentCats = getCategorySpending(currentMonthTxs);
  const lastMonthCats = getCategorySpending(lastMonthTxs);
  const alerts: CategoryAlert[] = [];

  Object.entries(currentCats).forEach(([cat, spent]) => {
    const lastMonthSpent = lastMonthCats[cat] || 0;
    const budget = categoryBudgets?.[cat] || 0;
    const color = currentMonthTxs.find(t => t.category?.label === cat)?.category?.color || '#888';

    // Alert 1: Significant increase
    if (lastMonthSpent > 0) {
      const changePercent = ((spent - lastMonthSpent) / lastMonthSpent) * 100;
      if (changePercent > 20) {
        alerts.push({
          category: cat,
          message: `📈 ${cat} up ${changePercent.toFixed(0)}% vs last month`,
          type: 'increase',
          changePercent,
          color,
        });
      }
    }

    // Alert 2: Highest spending category
    const maxSpending = Math.max(...Object.values(currentCats));
    if (maxSpending === spent && spent > 2000) {
      alerts.push({
        category: cat,
        message: `👑 ${cat} is your highest spending category`,
        type: 'highest',
        changePercent: 0,
        color,
      });
    }

    // Alert 3: Unusual/first time high spend
    if (lastMonthSpent === 0 && spent > 3000) {
      alerts.push({
        category: cat,
        message: `⚠️ Unusual: First major ${cat} expense (₹${spent})`,
        type: 'unusual',
        changePercent: 100,
        color,
      });
    }
  });

  return alerts.slice(0, 3); // Top 3 alerts
};
