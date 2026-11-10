/**
 * Sign convention for customer balances.
 *
 * Today v_customer_balances = SUM(credit) - SUM(debit). If an invoice is
 * written as a DEBIT (normal accounting) and a payment as a CREDIT, then a
 * customer who still owes money has a NEGATIVE balance.
 *
 * The team has not settled this yet (see the PR notes). When the views are
 * changed to debit - credit, flip this ONE constant and every screen follows.
 */
export const OWED_IS_NEGATIVE = true;

/** Positive result = the customer owes you that much. */
export function owedByCustomer(balance: number): number {
  return OWED_IS_NEGATIVE ? -balance : balance;
}
