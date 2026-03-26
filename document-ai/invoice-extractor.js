/**
 * Document AI Invoice Extractor
 * Sends a PDF invoice to Google Document AI and returns clean JSON.
 * Extracts: vendor, date, invoice number, line items, subtotal, tax, total.
 *
 * Google Cloud Project: geometric-gamma-487620-r6
 * Processor: invoice-parser-demo (e526b77939d1b06e)
 * Model: pretrained-invoice-v2.0-2023-12-06
 *
 * Usage:
 *   node ~/demo/invoice-extractor.js path/to/invoice.pdf
 *   node ~/demo/invoice-extractor.js path/to/invoice.pdf --pretty
 */

'use strict';

const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const { execSync } = require('child_process');

const PROJECT      = 'geometric-gamma-487620-r6';
const PROCESSOR_ID = 'e526b77939d1b06e';
const LOCATION     = 'us';
const ENDPOINT     = `${LOCATION}-documentai.googleapis.com`;

// ─── Auth ─────────────────────────────────────────────────────────────────────

function getToken() {
  try {
    return execSync('gcloud auth print-access-token 2>/dev/null', { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('Not authenticated. Run: gcloud auth login');
  }
}

// ─── Document AI API call ─────────────────────────────────────────────────────

function processDocument(pdfBase64, mimeType = 'application/pdf') {
  return new Promise((resolve, reject) => {
    const token = getToken();
    const body = JSON.stringify({
      rawDocument: {
        content: pdfBase64,
        mimeType,
      },
    });

    const req = https.request({
      hostname: ENDPOINT,
      path: `/v1/projects/${PROJECT}/locations/${LOCATION}/processors/${PROCESSOR_ID}:process`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Goog-User-Project': PROJECT,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Invalid response: ' + raw.slice(0, 200))); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Field extractor helpers ──────────────────────────────────────────────────

function getFieldValue(entities, fieldType) {
  const entity = entities.find(e => e.type === fieldType);
  return entity?.mentionText?.trim() || entity?.normalizedValue?.text?.trim() || null;
}

function getAllFields(entities, fieldType) {
  return entities
    .filter(e => e.type === fieldType)
    .map(e => e.mentionText?.trim() || e.normalizedValue?.text?.trim())
    .filter(Boolean);
}

function getMoneyValue(entities, fieldType) {
  const entity = entities.find(e => e.type === fieldType);
  if (!entity) return null;
  if (entity.normalizedValue?.moneyValue) {
    const m = entity.normalizedValue.moneyValue;
    return {
      amount: parseFloat(m.units || 0) + parseFloat((m.nanos || 0) / 1e9),
      currency: m.currencyCode || 'ZAR',
      raw: entity.mentionText?.trim(),
    };
  }
  return { raw: entity.mentionText?.trim() };
}

// ─── Line item extractor ──────────────────────────────────────────────────────

function extractLineItems(entities) {
  const lineItemEntities = entities.filter(e => e.type === 'line_item');
  return lineItemEntities.map(item => {
    const props = item.properties || [];
    return {
      description: getFieldValue(props, 'line_item/description'),
      quantity:    getFieldValue(props, 'line_item/quantity'),
      unit_price:  getFieldValue(props, 'line_item/unit_price'),
      amount:      getFieldValue(props, 'line_item/amount'),
    };
  }).filter(item => item.description || item.amount);
}

// ─── Main extraction function ─────────────────────────────────────────────────

async function extractInvoice(pdfPath) {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`File not found: ${pdfPath}`);
  }

  console.error(`[Document AI] Processing: ${path.basename(pdfPath)}`);
  console.error(`[Document AI] Processor: ${PROCESSOR_ID} (Invoice Parser v2.0)`);

  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBytes.toString('base64');

  const response = await processDocument(pdfBase64);

  if (response.error) {
    throw new Error(`Document AI error: ${response.error.message}`);
  }

  const entities = response.document?.entities || [];
  console.error(`[Document AI] Extracted ${entities.length} entities`);

  // Build clean output
  const result = {
    processor:      'Document AI Invoice Parser v2.0',
    project:        PROJECT,
    file:           path.basename(pdfPath),
    extracted_at:   new Date().toISOString(),
    confidence:     null,

    // Core invoice fields
    invoice_number: getFieldValue(entities, 'invoice_id'),
    invoice_date:   getFieldValue(entities, 'invoice_date'),
    due_date:       getFieldValue(entities, 'due_date'),
    purchase_order: getFieldValue(entities, 'purchase_order'),

    // Vendor
    vendor: {
      name:    getFieldValue(entities, 'supplier_name'),
      address: getFieldValue(entities, 'supplier_address'),
      email:   getFieldValue(entities, 'supplier_email'),
      phone:   getFieldValue(entities, 'supplier_phone'),
      tax_id:  getFieldValue(entities, 'supplier_tax_id'),
    },

    // Recipient
    recipient: {
      name:    getFieldValue(entities, 'receiver_name'),
      address: getFieldValue(entities, 'receiver_address'),
    },

    // Line items
    line_items: extractLineItems(entities),

    // Financials
    financials: {
      subtotal:    getMoneyValue(entities, 'net_amount'),
      tax:         getMoneyValue(entities, 'total_tax_amount'),
      tax_rate:    getFieldValue(entities, 'vat'),
      total:       getMoneyValue(entities, 'total_amount'),
      currency:    getFieldValue(entities, 'currency'),
    },

    // Payment
    payment: {
      terms:          getFieldValue(entities, 'payment_terms'),
      bank_account:   getFieldValue(entities, 'payment_info'),
    },

    // Raw entity count for debugging
    _raw_entity_count: entities.length,
  };

  // Remove null fields for clean output
  function pruneNulls(obj) {
    if (Array.isArray(obj)) return obj.map(pruneNulls).filter(Boolean);
    if (obj && typeof obj === 'object') {
      const cleaned = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined) continue;
        if (typeof v === 'object' && !Array.isArray(v)) {
          const sub = pruneNulls(v);
          if (Object.keys(sub).length > 0) cleaned[k] = sub;
        } else if (Array.isArray(v) && v.length === 0) {
          // skip empty arrays
        } else {
          cleaned[k] = pruneNulls(v);
        }
      }
      return cleaned;
    }
    return obj;
  }

  return pruneNulls(result);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const pdfPath = args.find(a => !a.startsWith('--'));
  const pretty  = args.includes('--pretty');

  if (!pdfPath) {
    console.error('Usage: node invoice-extractor.js <path/to/invoice.pdf> [--pretty]');
    process.exit(1);
  }

  extractInvoice(path.resolve(pdfPath))
    .then(result => {
      if (pretty) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(JSON.stringify(result));
      }
    })
    .catch(e => {
      console.error('Error:', e.message);
      process.exit(1);
    });
}

module.exports = { extractInvoice };
