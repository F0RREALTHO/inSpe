
export interface UpcomingRecurring {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  daysUntil: number;
  nextDueDate: Date;
  frequency: 'daily' | 'weekly' | 'monthly';
}


const getNextOccurrence = (lastDate: string, frequency: string): Date => {
  const last = new Date(lastDate);
  const next = new Date(last);

  if (frequency === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (frequency === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  }

  return next;
};


export const getUpcomingRecurringTransactions = (
  transactions: any[],
  daysWindow: number = 3
): UpcomingRecurring[] => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcoming: UpcomingRecurring[] = [];

  const recurringTxs = transactions.filter((t: any) => t.recurring && t.recurring !== 'none');

  recurringTxs.forEach((tx: any) => {
    const txType = tx.type === 'income' ? 'income' : 'expense';

    const lastDate = new Date(tx.date);
    const nextDue = getNextOccurrence(tx.date, tx.recurring);

    const daysUntil = Math.floor((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil >= 0 && daysUntil <= daysWindow) {
      upcoming.push({
        id: tx.id,
        description: tx.note || tx.category?.label || 'Recurring transaction',
        amount: Number(tx.amount),
        type: txType,
        daysUntil,
        nextDueDate: nextDue,
        frequency: tx.recurring,
      });
    }
  });

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
};

export const formatRecurringReminder = (upcoming: UpcomingRecurring[]): string => {
  if (upcoming.length === 0) {
    return 'No upcoming recurring transactions.';
  }

  const messages = upcoming.map((tx) => {
    const sign = tx.type === 'income' ? '+' : '-';
    const timeText = tx.daysUntil === 0 ? 'Today' : tx.daysUntil === 1 ? 'Tomorrow' : `In ${tx.daysUntil} days`;
    return `${timeText}: ${tx.description} (${sign}₹${tx.amount})`;
  });

  return messages.slice(0, 3).join('\n');
};
