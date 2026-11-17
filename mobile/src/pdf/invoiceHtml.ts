import { amountInWords } from '../lib/amountInWords';
import { formatINR } from '../lib/format';
import type { InvoiceDocument } from '../billing/invoiceDocument';

function esc(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function d(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

function money(n: number): string {
  return formatINR(n);
}

/**
 * Builds a GST tax invoice as a self-contained HTML document for expo-print.
 * Fields follow Rule 46 of the CGST Rules (mandatory particulars) as closely
 * as a local draft can: supplier identity/GSTIN, invoice no/date, buyer
 * details, place of supply, HSN, qty, rate, taxable value, tax-wise rates
 * and amounts, and the total in figures and words.
 */
export function buildInvoiceHtml(invoice: InvoiceDocument): string {
  const isInter = invoice.igstAmount > 0;
  const itemRows = invoice.items
    .map((item, idx) => {
      const cgstRate = isInter ? 0 : item.gstRate / 2;
      const sgstRate = isInter ? 0 : item.gstRate / 2;
      const igstRate = isInter ? item.gstRate : 0;
      return `<tr>
        <td class="c">${idx + 1}</td>
        <td>${esc(item.name)}</td>
        <td class="c">${esc(item.hsnCode || '')}</td>
        <td class="c">${item.quantity} ${esc(item.unit)}</td>
        <td class="r">${money(item.unitPrice)}</td>
        <td class="r">${item.discount ? money(item.discount) : '—'}</td>
        <td class="r">${money(item.taxableValue)}</td>
        <td class="c">${cgstRate ? cgstRate + '%' : '—'}</td>
        <td class="r">${item.cgstAmount ? money(item.cgstAmount) : '—'}</td>
        <td class="c">${sgstRate ? sgstRate + '%' : '—'}</td>
        <td class="r">${item.sgstAmount ? money(item.sgstAmount) : '—'}</td>
        <td class="c">${igstRate ? igstRate + '%' : '—'}</td>
        <td class="r">${item.igstAmount ? money(item.igstAmount) : '—'}</td>
        <td class="r">${money(item.lineTotal)}</td>
      </tr>`;
    })
    .join('');

  const buyerGstin = invoice.buyer?.gstin
    ? `<div><strong>GSTIN:</strong> ${esc(invoice.buyer.gstin)}</div>`
    : invoice.invoiceType === 'B2B'
      ? `<div><strong>GSTIN:</strong> <span class="warn">Missing (required for B2B)</span></div>`
      : `<div><strong>GSTIN:</strong> Unregistered / B2C</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Tax Invoice ${esc(invoice.invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Noto Sans', 'Noto Sans Tamil', DejaVu Sans, Arial, sans-serif; font-size: 11px; color: #13231B; margin: 16px; }
    h1 { font-size: 18px; letter-spacing: 1px; margin: 0 0 4px; text-align: center; }
    h2 { font-size: 13px; margin: 0; }
    .muted { color: #4A5E54; }
    .warn { color: #A9402C; }
    .box { border: 1px solid #333; padding: 8px; }
    .row { display: flex; gap: 0; }
    .col { flex: 1; }
    .col + .col { border-left: 1px solid #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #333; padding: 4px 5px; vertical-align: top; }
    th { background: #E3EFE8; font-size: 10px; }
    .c { text-align: center; }
    .r { text-align: right; }
    .totals { width: 280px; margin-left: auto; margin-top: 8px; }
    .totals td { border: none; padding: 2px 5px; }
    .totals tr.grand td { border-top: 2px solid #13231B; font-weight: 700; font-size: 13px; }
    .words { margin-top: 8px; font-weight: 700; }
    .sign { margin-top: 28px; text-align: right; }
    .fine { font-size: 9px; color: #4A5E54; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>TAX INVOICE</h1>
  <p class="muted c">Original for Recipient</p>
  <div class="row box">
    <div class="col">
      <h2>${esc(invoice.seller.name)}</h2>
      <div>${esc(invoice.seller.address || '')}</div>
      <div>${invoice.seller.phone ? 'Ph: ' + esc(invoice.seller.phone) : ''}</div>
      <div><strong>GSTIN:</strong> ${esc(invoice.seller.gstin || 'Not added')}</div>
      <div><strong>State:</strong> ${esc(invoice.seller.stateName || '')} (${esc(invoice.seller.stateCode || '')})</div>
    </div>
    <div class="col">
      <div><strong>Invoice No.:</strong> ${esc(invoice.invoiceNumber)}</div>
      <div><strong>Invoice Date:</strong> ${d(invoice.invoiceDate)}</div>
      <div><strong>Due Date:</strong> ${d(invoice.dueDate)}</div>
      <div><strong>Invoice Type:</strong> ${esc(invoice.invoiceType)}</div>
      <div><strong>Place of Supply:</strong> ${esc(invoice.placeOfSupplyName)} (${esc(invoice.placeOfSupplyCode)})</div>
      <div><strong>Reverse Charge:</strong> ${invoice.reverseCharge ? 'Yes' : 'No'}</div>
    </div>
  </div>
  <div class="box" style="border-top:0">
    <strong>Bill to / Recipient</strong>
    <div>${esc(invoice.buyer?.name || 'Walk-in customer')}</div>
    <div>${esc(invoice.buyer?.address || '')}</div>
    ${buyerGstin}
    <div><strong>State:</strong> ${esc(invoice.buyer?.stateName || invoice.placeOfSupplyName || '')} (${esc(invoice.buyer?.stateCode || invoice.placeOfSupplyCode)})</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Description</th>
        <th>HSN</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Disc.</th>
        <th>Taxable value</th>
        <th>CGST %</th>
        <th>CGST</th>
        <th>SGST %</th>
        <th>SGST</th>
        <th>IGST %</th>
        <th>IGST</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>
  <table class="totals">
    <tr><td>Taxable value</td><td class="r">${money(invoice.taxableAmount)}</td></tr>
    <tr><td>CGST</td><td class="r">${money(invoice.cgstAmount)}</td></tr>
    <tr><td>SGST</td><td class="r">${money(invoice.sgstAmount)}</td></tr>
    <tr><td>IGST</td><td class="r">${money(invoice.igstAmount)}</td></tr>
    <tr><td>Discount</td><td class="r">${money(invoice.discount)}</td></tr>
    <tr class="grand"><td>Total</td><td class="r">${money(invoice.totalAmount)}</td></tr>
  </table>
  <div class="words">Amount in words: ${esc(amountInWords(invoice.totalAmount))}</div>
  <div class="sign">
    <div>For ${esc(invoice.seller.name)}</div>
    <div style="margin-top:36px">Authorised Signatory</div>
  </div>
  <p class="fine">This is a computer-generated GST tax invoice under Rule 46 of the CGST Rules. It is a draft until filed / e-invoiced, if applicable.</p>
</body>
</html>`;
}
