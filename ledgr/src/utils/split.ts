import type { Expense } from '../types';

/** Amount the user is actually out of pocket for, after subtracting whatever
 *  others owe them for a split expense. Falls back to the full amount when
 *  the expense isn't split. This is what should feed every budget/category/
 *  trend total in the app — `amount` itself stays the full original charge,
 *  shown as-is in the expense table for reconciliation against the statement. */
export function yourShare(expense: Pick<Expense, 'amount' | 'splitOwed'>): number {
  const share = expense.amount - (expense.splitOwed ?? 0);
  return share > 0 ? share : 0;
}

/** Compute the "owed by others" amount for an even N-way split, given the
 *  full charge and the total number of people sharing it (including the
 *  person who paid). Returns 0 when there's nothing to split (1 or fewer
 *  people, or a non-finite/invalid count). */
export function evenSplitOwed(amount: number, people: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(people) || people <= 1) return 0;
  return (amount * (people - 1)) / people;
}
