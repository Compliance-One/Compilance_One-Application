-- VBAL: Real-time Customer Balances
CREATE OR REPLACE VIEW v_customer_balances AS
SELECT 
    business_id,
    customer_id,
    (SUM(credit) - SUM(debit)) AS balance
FROM ledger_entries
GROUP BY business_id, customer_id;

-- VPL: Dynamic Profit and Loss Calculation
CREATE OR REPLACE VIEW v_profit_loss AS
SELECT 
    b.id AS business_id,
    COALESCE(inv.total_revenue, 0) AS total_revenue,
    COALESCE(exp.total_expenses, 0) AS total_expenses,
    (COALESCE(inv.total_revenue, 0) - COALESCE(exp.total_expenses, 0)) AS net_profit
FROM businesses b
LEFT JOIN (
    SELECT business_id, SUM(taxable_amount) AS total_revenue 
    FROM invoices 
    GROUP BY business_id
) inv ON b.id = inv.business_id
LEFT JOIN (
    SELECT business_id, SUM(amount) AS total_expenses 
    FROM expenses 
    GROUP BY business_id
) exp ON b.id = exp.business_id;

-- VBS: Real-time Balance Sheet Asset Valuation (Expanded)
CREATE OR REPLACE VIEW v_balance_sheet AS
SELECT 
    b.id AS business_id,
    COALESCE(rec.receivables, 0) AS total_receivables,
    COALESCE(inv_val.inventory_value, 0) AS inventory_asset_value,
    COALESCE(cash.cash_balance, 0) AS cash_balance,
    COALESCE(pay.payables, 0) AS supplier_payables,
    (COALESCE(rec.receivables, 0) + COALESCE(inv_val.inventory_value, 0) + COALESCE(cash.cash_balance, 0)) AS total_assets,
    COALESCE(pay.payables, 0) AS total_liabilities
FROM businesses b
LEFT JOIN (
    SELECT business_id, SUM(debit - credit) AS receivables 
    FROM ledger_entries 
    GROUP BY business_id
) rec ON b.id = rec.business_id
LEFT JOIN (
    SELECT business_id, SUM(stock_quantity * price) AS inventory_value 
    FROM products 
    GROUP BY business_id
) inv_val ON b.id = inv_val.business_id
LEFT JOIN (
    SELECT p.business_id, (COALESCE(pay_in.total_in, 0) - COALESCE(exp_out.total_out, 0)) AS cash_balance
    FROM businesses p
    LEFT JOIN (
        SELECT i.business_id, SUM(pmt.amount) as total_in 
        FROM payments pmt 
        JOIN invoices i ON pmt.invoice_id = i.id 
        GROUP BY i.business_id
    ) pay_in ON p.id = pay_in.business_id
    LEFT JOIN (
        SELECT business_id, SUM(amount) as total_out 
        FROM expenses 
        GROUP BY business_id
    ) exp_out ON p.id = exp_out.business_id
) cash ON b.id = cash.business_id
LEFT JOIN (
    SELECT business_id, SUM(amount) AS payables 
    FROM purchases 
    WHERE UPPER(payment_status) = 'UNPAID'
    GROUP BY business_id
) pay ON b.id = pay.business_id;
