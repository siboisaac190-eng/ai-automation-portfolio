# Document AI Invoice Extractor

Drop a PDF invoice in. Get clean JSON out. In under 3 seconds.

**Live stack:** Google Document AI (Invoice Parser v2.0) + Node.js (zero npm)

## Sample Output

```json
{
  "invoice_number": "INV-2024-0847",
  "invoice_date":   "15 March 2024",
  "due_date":       "14 April 2024",
  "vendor": {
    "name":    "Tech Solutions (Pty) Ltd",
    "address": "15 Innovation Drive, Cape Town, 8001",
    "email":   "accounts@techsolutions.co.za",
    "tax_id":  "4890123456"
  },
  "recipient": {
    "name":    "Ndlovu Accounting Inc",
    "address": "22 Adderley Street, Cape Town CBD, 8000"
  },
  "line_items": [
    { "description": "Website Development - Phase 1", "quantity": "1", "amount": "8,500.00" },
    { "description": "Monthly Hosting & Maintenance",  "quantity": "3", "amount": "2,850.00" },
    { "description": "SEO Optimisation Package",       "quantity": "1", "amount": "3,200.00" },
    { "description": "SSL Certificate (Annual)",       "quantity": "1", "amount": "450.00"   }
  ],
  "financials": {
    "subtotal": "R 15,000.00",
    "tax":      "R 2,250.00",
    "total":    "R 17,250.00"
  },
  "payment": { "terms": "30 days net" }
}
```

## Setup

```bash
# Requires Google Cloud project with Document AI enabled
# Set PROJECT and PROCESSOR_ID in invoice-extractor.js

node invoice-extractor.js path/to/invoice.pdf --pretty
```

## What Gets Extracted

From every PDF invoice:
- Invoice number, date, due date
- Vendor: name, address, email, phone, VAT number
- Recipient: name and address
- All line items: description, quantity, unit price, amount
- Financials: subtotal, VAT, total
- Payment terms and banking details

## Supported Formats

PDF, TIFF, JPEG, PNG — any invoice format, any language, any layout.

## Sell This To

Accounting firms processing 100+ invoices/month. At 300 invoices/month, saves 3 hours/day of data entry.

**Price: R20,000 setup + R3,000/month**
ROI: 300 invoices/month → R7,470/month saved → payback in 45 days.
