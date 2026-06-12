import { NextResponse } from 'next/server';
import { calculateGasb34Data } from '@/lib/gasb34Calculator';
import PDFDocument from 'pdfkit';

// Rounding factor helper
const getRoundingFactor = (rounding) => {
  if (rounding === 'thousands') return 1000;
  if (rounding === 'millions') return 1000000;
  return 1;
};

// Professional accounting currency formatter
const formatVal = (val, rounding) => {
  if (val === undefined || val === null || isNaN(val)) return '-';
  const factor = getRoundingFactor(rounding);
  const adjustedVal = val / factor;
  
  if (Math.abs(adjustedVal) < 0.001) {
    return factor === 1 ? '0.00' : '0.0';
  }
  
  const formatted = Math.abs(adjustedVal).toLocaleString('en-US', {
    minimumFractionDigits: factor === 1 ? 2 : 1,
    maximumFractionDigits: factor === 1 ? 2 : 1
  });
  
  if (adjustedVal < 0) {
    return `(${formatted})`;
  }
  return formatted;
};

const formatPct = (pct) => {
  if (pct === undefined || pct === null || isNaN(pct)) return '-';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
};

// Draw PDF Page Header
function drawPageHeader(doc, title, fiscalYear, periodCode, rounding) {
  doc.fillColor('#0f172a')
     .font('Helvetica-Bold')
     .fontSize(14)
     .text('NEW YORK STATE GAMING COMMISSION', 30, 30);
  
  doc.fontSize(11)
     .fillColor('#1e293b')
     .text(title.toUpperCase(), 30, 48);

  const periodLabel = `Fiscal Year ${fiscalYear} | Filing Period ${periodCode}`;
  doc.fontSize(9)
     .fillColor('#64748b')
     .font('Helvetica-Oblique')
     .text(periodLabel, 30, 64);

  const roundingNote = `Presented in ${rounding === 'exact' ? 'exact dollars' : rounding === 'thousands' ? 'thousands of dollars' : 'millions of dollars'}`;
  doc.font('Helvetica')
     .text(roundingNote, 762 - doc.widthOfString(roundingNote), 64);

  // Decorative divider line
  doc.strokeColor('#cbd5e1')
     .lineWidth(1.5)
     .moveTo(30, 78)
     .lineTo(762, 78)
     .stroke();
}

// Draw page footer with page number
function drawPageFooter(doc, pageNum, totalPages) {
  doc.strokeColor('#e2e8f0')
     .lineWidth(0.5)
     .moveTo(30, 575)
     .lineTo(762, 575)
     .stroke();

  doc.fillColor('#94a3b8')
     .font('Helvetica')
     .fontSize(7.5)
     .text('STOCHOS PLATFORM - CONSOLIDATED STATUTORY FINANCIAL REPORTING', 30, 582);

  const pageStr = `Page ${pageNum} of ${totalPages}`;
  doc.text(pageStr, 762 - doc.widthOfString(pageStr), 582);
}

function drawTableHeader(doc, y, fiscalYear) {
  doc.fillColor('#1e293b').rect(30, y, 732, 18).fill();
  doc.fillColor('#ffffff')
     .font('Helvetica-Bold')
     .fontSize(8.5);
  doc.text('Line Item / Classification', 38, y + 5);
  doc.text(`FY ${fiscalYear}`, 400, y + 5, { width: 85, align: 'right' });
  doc.text(`FY ${fiscalYear - 1}`, 490, y + 5, { width: 85, align: 'right' });
  doc.text('Variance ($)', 580, y + 5, { width: 80, align: 'right' });
  doc.text('Change (%)', 670, y + 5, { width: 80, align: 'right' });
}

function drawTableRow(doc, y, label, currentVal, priorVal, rounding, isSubtotal = false, isTotal = false, depth = 0, isHeader = false) {
  const currentStr = isHeader ? '' : formatVal(currentVal, rounding);
  const priorStr = isHeader ? '' : formatVal(priorVal, rounding);
  
  const diff = (currentVal || 0) - (priorVal || 0);
  const pct = priorVal && priorVal !== 0 ? (diff / Math.abs(priorVal)) * 100 : null;
  
  const diffStr = isHeader ? '' : formatVal(diff, rounding);
  const pctStr = isHeader ? '' : formatPct(pct);

  // Background shading
  if (isTotal) {
    doc.fillColor('#f1f5f9').rect(30, y, 732, 16).fill();
  } else if (isSubtotal) {
    doc.fillColor('#f8fafc').rect(30, y, 732, 16).fill();
  } else if (isHeader) {
    doc.fillColor('#f8fafc').rect(30, y, 732, 14).fill();
  }

  // Row lines
  doc.strokeColor('#e2e8f0').lineWidth(0.5);
  doc.moveTo(30, y + (isHeader ? 14 : 16)).lineTo(762, y + (isHeader ? 14 : 16)).stroke();

  if (isTotal) {
    // Accounting double-underline
    doc.strokeColor('#475569').lineWidth(0.75);
    doc.moveTo(400, y + 13).lineTo(762, y + 13).stroke();
    doc.moveTo(400, y + 15).lineTo(762, y + 15).stroke();
  }

  doc.fillColor('#0f172a');
  if (isHeader) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569');
    doc.text(label.toUpperCase(), 38 + (depth * 15), y + 3);
  } else {
    doc.font(isSubtotal || isTotal ? 'Helvetica-Bold' : 'Helvetica')
       .fontSize(isSubtotal || isTotal ? 8.5 : 8)
       .fillColor(isSubtotal || isTotal ? '#0f172a' : '#1e293b');
    
    doc.text(label, 38 + (depth * 15), y + 4, { width: 350 });
    doc.text(currentStr, 400, y + 4, { width: 85, align: 'right' });
    doc.text(priorStr, 490, y + 4, { width: 85, align: 'right' });
    
    // Variance colors: teal for positive variance, red for negative
    const isNeg = diff < 0;
    doc.fillColor(isNeg ? '#b91c1c' : '#0f766e');
    doc.text(diffStr, 580, y + 4, { width: 80, align: 'right' });
    doc.text(pctStr, 670, y + 4, { width: 80, align: 'right' });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jurisdictionId = searchParams.get('jurisdictionId') || 'NY-LOTTERY';
    const fiscalYear = parseInt(searchParams.get('fiscalYear') || '2025', 10);
    const periodCode = searchParams.get('periodCode') || 'P03';
    const rounding = searchParams.get('rounding') || 'exact';

    // Fetch compiled financial data
    const data = await calculateGasb34Data(jurisdictionId, fiscalYear, periodCode);

    // Create a new PDF Document in Landscape mode
    const doc = new PDFDocument({ layout: 'landscape', size: 'letter', margin: 30 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    
    // Wrapped in a Promise to return Response when stream ends
    const pdfPromise = new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    const totalPages = 4;

    // ==========================================================
    // PAGE 1: STATEMENT OF NET POSITION
    // ==========================================================
    drawPageHeader(doc, 'Statement of Net Position', fiscalYear, periodCode, rounding);
    let y = 92;
    drawTableHeader(doc, y, fiscalYear);
    y += 18;

    let currentGroup = '';
    const npRows = data.netPositionRows || [];

    npRows.forEach((row) => {
      if (row.section !== currentGroup) {
        currentGroup = row.section;
        if (currentGroup === 'currentAssets') {
          drawTableRow(doc, y, 'ASSETS', 0, 0, rounding, false, false, 0, true);
          y += 14;
          drawTableRow(doc, y, 'Current Assets', 0, 0, rounding, true, false, 0.5, false);
          y += 16;
        } else if (currentGroup === 'nonCurrentAssets') {
          drawTableRow(doc, y, 'Non-Current Assets', 0, 0, rounding, true, false, 0.5, false);
          y += 16;
        } else if (currentGroup === 'liabilities') {
          drawTableRow(doc, y, 'LIABILITIES', 0, 0, rounding, false, false, 0, true);
          y += 14;
          drawTableRow(doc, y, 'Current Liabilities', 0, 0, rounding, true, false, 0.5, false);
          y += 16;
        } else if (currentGroup === 'netPosition') {
          drawTableRow(doc, y, 'NET POSITION', 0, 0, rounding, false, false, 0, true);
          y += 14;
        }
      }

      const isSubtotal = row.rowType === 'subtotal';
      const isTotal = row.rowType === 'total';
      const depth = (isSubtotal || isTotal) ? 0.5 : 1;

      drawTableRow(doc, y, row.label, row.current, row.prior, rounding, isSubtotal, isTotal, depth);
      y += 16;
    });

    drawPageFooter(doc, 1, totalPages);

    // ==========================================================
    // PAGE 2: STATEMENT OF REVENUES, EXPENSES, & CHANGES
    // ==========================================================
    doc.addPage();
    drawPageHeader(doc, 'Statement of Revenues, Expenses, and Changes in Net Position', fiscalYear, periodCode, rounding);
    y = 92;
    drawTableHeader(doc, y, fiscalYear);
    y += 18;

    currentGroup = '';
    const reRows = data.revenuesExpensesRows || [];

    reRows.forEach((row) => {
      if (row.section !== currentGroup) {
        currentGroup = row.section;
        if (currentGroup === 'operatingRevenues') {
          drawTableRow(doc, y, 'Operating Revenues', 0, 0, rounding, false, false, 0, true);
          y += 14;
        } else if (currentGroup === 'operatingExpenses') {
          drawTableRow(doc, y, 'Operating Expenses', 0, 0, rounding, false, false, 0, true);
          y += 14;
        } else if (currentGroup === 'nonOperating') {
          drawTableRow(doc, y, 'Non-Operating Items & Transfers', 0, 0, rounding, false, false, 0, true);
          y += 14;
        }
      }

      const isSubtotal = row.rowType === 'subtotal';
      const isTotal = row.rowType === 'total';
      const depth = (isSubtotal || isTotal) ? 0.5 : 1;

      drawTableRow(doc, y, row.label, row.current, row.prior, rounding, isSubtotal, isTotal, depth);
      y += 16;
    });

    drawPageFooter(doc, 2, totalPages);

    // ==========================================================
    // PAGE 3: STATEMENT OF CASH FLOWS
    // ==========================================================
    doc.addPage();
    drawPageHeader(doc, 'Statement of Cash Flows', fiscalYear, periodCode, rounding);
    y = 92;
    drawTableHeader(doc, y, fiscalYear);
    y += 18;

    currentGroup = '';
    const cfRows = data.cashFlowRows || [];

    cfRows.forEach((row) => {
      if (row.section !== currentGroup) {
        currentGroup = row.section;
        if (currentGroup === 'cashOperating') {
          drawTableRow(doc, y, 'Cash flows from operating activities', 0, 0, rounding, false, false, 0, true);
          y += 14;
        } else if (currentGroup === 'cashFinancing') {
          drawTableRow(doc, y, 'Cash flows from noncapital financing activities', 0, 0, rounding, false, false, 0, true);
          y += 14;
        } else if (currentGroup === 'cashCapital') {
          drawTableRow(doc, y, 'Cash flows from capital and related financing activities', 0, 0, rounding, false, false, 0, true);
          y += 14;
        } else if (currentGroup === 'cashInvesting') {
          drawTableRow(doc, y, 'Cash flows from investing activities', 0, 0, rounding, false, false, 0, true);
          y += 14;
        } else if (currentGroup === 'cashRollForward') {
          drawTableRow(doc, y, 'Cash Roll Forward', 0, 0, rounding, false, false, 0, true);
          y += 14;
        }
      }

      const isSubtotal = row.rowType === 'subtotal';
      const isTotal = row.rowType === 'total';
      const depth = (isSubtotal || isTotal) ? 0.5 : 1;

      drawTableRow(doc, y, row.label, row.current, row.prior, rounding, isSubtotal, isTotal, depth);
      y += 16;
    });

    drawPageFooter(doc, 3, totalPages);

    // ==========================================================
    // PAGE 4: CASH FLOWS RECONCILIATION
    // ==========================================================
    doc.addPage();
    drawPageHeader(doc, 'Statement of Cash Flows (Reconciliation)', fiscalYear, periodCode, rounding);
    y = 92;
    drawTableHeader(doc, y, fiscalYear);
    y += 18;

    const cfObj = data.cashFlows;

    // Header
    drawTableRow(doc, y, 'RECONCILIATION OF OPERATING INCOME TO NET CASH PROVIDED BY OPERATING ACTIVITIES', 0, 0, rounding, false, false, 0, true);
    y += 14;

    // Operating Income row
    drawTableRow(doc, y, 'Operating Income (Loss)', cfObj.reconciliation.operatingIncome.current, cfObj.reconciliation.operatingIncome.prior, rounding, true, false, 0.5);
    y += 16;

    // Sub-header for adjustments
    drawTableRow(doc, y, 'Adjustments to Reconcile Operating Income to Net Cash:', 0, 0, rounding, false, false, 0.5, true);
    y += 14;

    // Non-cash depreciation
    drawTableRow(doc, y, 'Depreciation expense', cfObj.reconciliation.depreciation.current, cfObj.reconciliation.depreciation.prior, rounding, false, false, 1);
    y += 16;

    // Balance changes
    drawTableRow(doc, y, 'Decrease (increase) in Accounts Receivable, net', cfObj.reconciliation.arChange.current, cfObj.reconciliation.arChange.prior, rounding, false, false, 1);
    y += 16;
    drawTableRow(doc, y, 'Decrease (increase) in Prepaid Expenses', cfObj.reconciliation.prepaidsChange.current, cfObj.reconciliation.prepaidsChange.prior, rounding, false, false, 1);
    y += 16;
    drawTableRow(doc, y, 'Increase (decrease) in Accounts Payable', cfObj.reconciliation.apChange.current, cfObj.reconciliation.apChange.prior, rounding, false, false, 1);
    y += 16;
    drawTableRow(doc, y, 'Increase (decrease) in Prizes Payable', cfObj.reconciliation.prizesChange.current, cfObj.reconciliation.prizesChange.prior, rounding, false, false, 1);
    y += 16;
    drawTableRow(doc, y, 'Increase (decrease) in Unearned Revenue', cfObj.reconciliation.unearnedChange.current, cfObj.reconciliation.unearnedChange.prior, rounding, false, false, 1);
    y += 16;

    // Totals
    drawTableRow(doc, y, 'Net Cash Provided by Operating Activities', cfObj.reconciliation.netCashOperating.current, cfObj.reconciliation.netCashOperating.prior, rounding, false, true, 0.5);
    y += 16;

    drawPageFooter(doc, 4, totalPages);

    // Close the document
    doc.end();

    const pdfBuffer = await pdfPromise;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="NYSGC-GASB34-FY${fiscalYear}-${periodCode}.pdf"`,
      }
    });

  } catch (error) {
    console.error('Error generating GASB 34 PDF:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate PDF report', details: error.message }, { status: 500 });
  }
}
