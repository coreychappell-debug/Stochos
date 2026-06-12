const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { calculateGasb34Data } = require('../lib/gasb34Calculator');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const getRoundingFactor = (rounding) => {
  if (rounding === 'thousands') return 1000;
  if (rounding === 'millions') return 1000000;
  return 1;
};

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

  doc.strokeColor('#cbd5e1')
     .lineWidth(1.5)
     .moveTo(30, 78)
     .lineTo(762, 78)
     .stroke();
}

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

  if (isTotal) {
    doc.fillColor('#f1f5f9').rect(30, y, 732, 16).fill();
  } else if (isSubtotal) {
    doc.fillColor('#f8fafc').rect(30, y, 732, 16).fill();
  } else if (isHeader) {
    doc.fillColor('#f8fafc').rect(30, y, 732, 14).fill();
  }

  doc.strokeColor('#e2e8f0').lineWidth(0.5);
  doc.moveTo(30, y + (isHeader ? 14 : 16)).lineTo(762, y + (isHeader ? 14 : 16)).stroke();

  if (isTotal) {
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
    
    const isNeg = diff < 0;
    doc.fillColor(isNeg ? '#b91c1c' : '#0f766e');
    doc.text(diffStr, 580, y + 4, { width: 80, align: 'right' });
    doc.text(pctStr, 670, y + 4, { width: 80, align: 'right' });
  }
}

async function testPdfGeneration() {
  console.log("======================================================");
  docPath = path.join(__dirname, 'test-gasb34-compiled.pdf');
  console.log(`TESTING GASB 34 PDF GENERATION -> ${docPath}`);
  console.log("======================================================");

  try {
    // 1. Fetch calculations
    console.log("[1/4] Calculating GASB 34 financial statements from DB...");
    const data = await calculateGasb34Data('NY-LOTTERY', 2025, 'P03');
    console.log(`  - DB calculations complete. Double-Entry balanced: ${data.isBalanced}`);

    // 2. Setup pdfkit
    console.log("[2/4] Initializing pdfkit Landscape document...");
    const doc = new PDFDocument({ layout: 'landscape', size: 'letter', margin: 30 });
    const writeStream = fs.createWriteStream(docPath);
    doc.pipe(writeStream);

    const rounding = 'thousands';
    const totalPages = 4;

    // Page 1: Net Position
    console.log("[3/4] Building PDF Page 1: Statement of Net Position...");
    drawPageHeader(doc, 'Statement of Net Position', 2025, 'P03', rounding);
    let y = 92;
    drawTableHeader(doc, y, 2025);
    y += 18;

    let currentGroup = '';
    data.netPositionRows.forEach((row) => {
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

    // Page 2: Revenues & Expenses
    console.log("      Building PDF Page 2: Statement of Revenues, Expenses, and Changes...");
    doc.addPage();
    drawPageHeader(doc, 'Statement of Revenues, Expenses, and Changes in Net Position', 2025, 'P03', rounding);
    y = 92;
    drawTableHeader(doc, y, 2025);
    y += 18;
    currentGroup = '';
    data.revenuesExpensesRows.forEach((row) => {
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

    // Page 3: Cash Flows
    console.log("      Building PDF Page 3: Statement of Cash Flows...");
    doc.addPage();
    drawPageHeader(doc, 'Statement of Cash Flows', 2025, 'P03', rounding);
    y = 92;
    drawTableHeader(doc, y, 2025);
    y += 18;
    currentGroup = '';
    data.cashFlowRows.forEach((row) => {
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

    // Page 4: Reconciliation
    console.log("      Building PDF Page 4: Indirect Cash Flows Reconciliation...");
    doc.addPage();
    drawPageHeader(doc, 'Statement of Cash Flows (Reconciliation)', 2025, 'P03', rounding);
    y = 92;
    drawTableHeader(doc, y, 2025);
    y += 18;
    const cfObj = data.cashFlows;
    drawTableRow(doc, y, 'RECONCILIATION OF OPERATING INCOME TO NET CASH PROVIDED BY OPERATING ACTIVITIES', 0, 0, rounding, false, false, 0, true);
    y += 14;
    drawTableRow(doc, y, 'Operating Income (Loss)', cfObj.reconciliation.operatingIncome.current, cfObj.reconciliation.operatingIncome.prior, rounding, true, false, 0.5);
    y += 16;
    drawTableRow(doc, y, 'Adjustments to Reconcile Operating Income to Net Cash:', 0, 0, rounding, false, false, 0.5, true);
    y += 14;
    drawTableRow(doc, y, 'Depreciation expense', cfObj.reconciliation.depreciation.current, cfObj.reconciliation.depreciation.prior, rounding, false, false, 1);
    y += 16;
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
    drawTableRow(doc, y, 'Net Cash Provided by Operating Activities', cfObj.reconciliation.netCashOperating.current, cfObj.reconciliation.netCashOperating.prior, rounding, false, true, 0.5);
    y += 16;
    drawPageFooter(doc, 4, totalPages);

    // Finalize
    doc.end();

    writeStream.on('finish', () => {
      console.log("[4/4] PDF file saved to disk successfully.");
      
      // Verify PDF Signature
      const buffer = fs.readFileSync(docPath);
      const signature = buffer.slice(0, 4).toString();
      const fileSizeK = (buffer.length / 1024).toFixed(1);
      
      console.log("\n=================== VERIFICATION RESULTS ===================");
      console.log(`- File Path: ${docPath}`);
      console.log(`- File Size: ${fileSizeK} KB`);
      console.log(`- Header Signature: ${signature} (Expected: %PDF)`);
      
      if (signature === '%PDF') {
        console.log("- Status: SUCCESS (Valid PDF signature found!)");
        console.log("======================================================");
      } else {
        console.error("- Status: ERROR (Invalid PDF header signature!)");
        console.log("======================================================");
        process.exit(1);
      }
    });

  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  }
}

testPdfGeneration();
