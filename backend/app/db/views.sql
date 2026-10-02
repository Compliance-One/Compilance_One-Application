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

-- VBS: Real-time Balance Sheet Asset Valuation
CREATE OR REPLACE VIEW v_balance_sheet AS
SELECT 
    b.id AS business_id,
    COALESCE(rec.receivables, 0) AS total_receivables,
    COALESCE(inv_val.inventory_value, 0) AS inventory_asset_value,
    (COALESCE(rec.receivables, 0) + COALESCE(inv_val.inventory_value, 0)) AS total_assets
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
) inv_val ON b.id = inv_val.business_id;
