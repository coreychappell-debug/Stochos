import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

// Code 39 character patterns (5 bars, 4 spaces. W = Wide, N = Narrow)
const CODE39_MAP = {
  '0': 'NNNWWNWNN', '1': 'WNNWNNNNW', '2': 'NNWWNNNNW', '3': 'WNWWNNNNN',
  '4': 'NNNWWNNNW', '5': 'WNNWWNNNN', '6': 'NNWWWNNNN', '7': 'NNNWNNWNW',
  '8': 'WNNWNNWNN', '9': 'NNWWNNWNN',
  'A': 'WNNNNWNNW', 'B': 'NNWNNWNNW', 'C': 'WNWNNWNNN', 'D': 'NNNNWWNNW',
  'E': 'WNNNWWNNN', 'F': 'NNWNWWNNN', 'G': 'NNNNNWNWW', 'H': 'WNNNNWNWN',
  'I': 'NNWNNWNWN', 'J': 'NNNNWWNWN',
  'K': 'WNNNNNNWW', 'L': 'NNWNNNNWW', 'M': 'WNWNNNNWN', 'N': 'NNNNWNNWW',
  'O': 'WNNNWNNWN', 'P': 'NNWNWNNWN', 'Q': 'NNNNNNWWW', 'R': 'WNNNNNWWN',
  'S': 'NNWNNNWWN', 'T': 'NNNNWNWWN',
  'U': 'WWNNNNNNW', 'V': 'NWWNNNNNW', 'W': 'WWWNNNNNN', 'X': 'NWNNWNNNW',
  'Y': 'WWNNWNNNN', 'Z': 'NWWNWNNNN',
  '-': 'NWNNNNWNW', '.': 'WWNNNNWNN', ' ': 'NWWNNNWNN', '*': 'NWNNWNWNN',
  '$': 'NWNWNWNNN', '/': 'NWNWNNNWN', '+': 'NWNNNWNWN', '%': 'NNNWNWNWN'
};

const CATEGORIES = {
  computer: "Computer",
  mobile: "Mobile Device",
  scanner: "Barcode Scanner",
  peripheral: "Peripheral",
  furniture: "Office Furniture",
  other: "Other Asset",
};

export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");
  const style = searchParams.get("style") || "barcode";

  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const baseUrl = `${protocol}://${host}`;

  if (!idsParam) {
    return NextResponse.json({ error: "ids parameter is required" }, { status: 400 });
  }

  const ids = idsParam.split(",").filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ error: "No asset IDs provided" }, { status: 400 });
  }

  try {
    const assets = await prisma.asset.findMany({
      where: { id: { in: ids } },
    });

    if (assets.length === 0) {
      return NextResponse.json({ error: "No assets found matching the IDs" }, { status: 404 });
    }

    // Sort assets in the order of the ids parameter to preserve selection order
    assets.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

    // Create a PDF document (standard Letter size, portrait)
    // Letter page size is 612 x 792 points
    const doc = new PDFDocument({
      size: "letter",
      margins: { top: 36, bottom: 36, left: 11.5, right: 11.5 },
      bufferPages: true,
    });

    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));

    const drawPromise = new Promise((resolve) => {
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
    });

    // Helper to draw Code 39 barcode as vector paths
    const drawCode39 = (x, y, text, height = 42, narrowWidth = 0.95, wideWidth = 2.4) => {
      const code = `*${text.toUpperCase().trim()}*`;
      let currentX = x;

      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const pattern = CODE39_MAP[char] || CODE39_MAP['-']; // Fallback to hyphen for unsupported characters

        for (let j = 0; j < 9; j++) {
          const isBar = (j % 2 === 0);
          const isWide = (pattern[j] === "W");
          const width = isWide ? wideWidth : narrowWidth;

          if (isBar) {
            doc.rect(currentX, y, width, height).fill("#000000");
          }
          currentX += width;
        }
        currentX += narrowWidth; // inter-character gap
      }
    };

    // Helper to draw QR code as vector paths
    const drawQRCode = (x, y, url, size = 68) => {
      try {
        const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
        const matrixSize = qr.modules.size;
        const cellSize = size / matrixSize;

        for (let row = 0; row < matrixSize; row++) {
          for (let col = 0; col < matrixSize; col++) {
            if (qr.modules.get(row, col)) {
              doc.rect(x + col * cellSize, y + row * cellSize, cellSize, cellSize).fill("#000000");
            }
          }
        }
      } catch (err) {
        console.error("Error drawing QR code:", err);
      }
    };

    // Layout dimensions (Avery 5163 style)
    const labelWidth = 288;
    const labelHeight = 144;
    const horizGutter = 13;
    const leftMargin = 11.5;
    const topMargin = 36;

    assets.forEach((asset, index) => {
      if (index > 0 && index % 10 === 0) {
        doc.addPage();
      }

      const localIndex = index % 10;
      const row = Math.floor(localIndex / 2);
      const col = localIndex % 2;

      const x = leftMargin + col * (labelWidth + horizGutter);
      const y = topMargin + row * labelHeight;

      // Draw faint crop/border for guidance (0.5 pt light grey)
      doc.rect(x, y, labelWidth, labelHeight)
         .strokeColor("#e2e8f0")
         .lineWidth(0.5)
         .stroke();

      if (style === "qrcode") {
        const qrSize = 72;
        const qrX = x + 16;
        const qrY = y + (labelHeight - qrSize) / 2; // vertically centered

        // Deep link URL pointing back to the assets screen with target tag parameter
        const assetUrl = `${baseUrl}/assets/?tag=${asset.assetTag.toUpperCase().trim()}`;

        // Draw vector QR Code
        drawQRCode(qrX, qrY, assetUrl, qrSize);

        // Right side info column
        const infoX = x + 104;

        // Header
        doc.fillColor("#475569")
           .font("Helvetica-Bold")
           .fontSize(7)
           .text("STOCHOS ASSET TAG", infoX, y + 20);

        // Asset Name
        doc.fillColor("#0f172a")
           .font("Helvetica-Bold")
           .fontSize(9.5)
           .text(asset.name, infoX, y + 32, { width: 172, ellipsis: true, height: 26 });

        // Asset Tag
        doc.fillColor("#334155")
           .font("Helvetica")
           .fontSize(9)
           .text(`Tag: ${asset.assetTag.toUpperCase().trim()}`, infoX, y + 64);

        // Category
        const categoryLabel = CATEGORIES[asset.category] || "Asset";
        doc.fillColor("#64748b")
           .font("Helvetica")
           .fontSize(8)
           .text(`Category: ${categoryLabel}`, infoX, y + 78, { width: 172, ellipsis: true, height: 12 });

        // Serial Number
        const snLabel = asset.serialNumber ? `S/N: ${asset.serialNumber}` : "No S/N";
        doc.text(snLabel, infoX, y + 92, { width: 172, ellipsis: true, height: 12 });
      } else {
        // Header
        doc.fillColor("#475569")
           .font("Helvetica-Bold")
           .fontSize(7)
           .text("STOCHOS ASSET TAG", x + 12, y + 12, { width: 264, align: "center" });

        // Asset Name
        doc.fillColor("#0f172a")
           .font("Helvetica-Bold")
           .fontSize(9)
           .text(asset.name, x + 12, y + 24, { width: 264, align: "center", ellipsis: true, height: 12 });

        // Barcode calculation to center it
        const barcodeText = asset.assetTag.toUpperCase().trim();
        const charCount = barcodeText.length + 2; // +2 for start/stop asterisks
        const narrow = 0.95;
        const wide = 2.4;
        // Code 39 width calculation: 6 narrow + 3 wide per char + 1 narrow gap.
        const charWidth = (6 * narrow) + (3 * wide) + narrow;
        const barcodeWidth = charCount * charWidth - narrow; // remove last gap
        const barcodeX = x + (labelWidth - barcodeWidth) / 2;

        // Draw vector barcode
        drawCode39(barcodeX, y + 42, barcodeText, 45, narrow, wide);

        // Human-readable asset tag
        doc.fillColor("#334155")
           .font("Helvetica")
           .fontSize(9)
           .text(`* ${barcodeText} *`, x + 12, y + 94, { width: 264, align: "center" });

        // Footer: Category and S/N
        const categoryLabel = CATEGORIES[asset.category] || "Asset";
        const snLabel = asset.serialNumber ? `S/N: ${asset.serialNumber}` : "No S/N";
        doc.fillColor("#64748b")
           .font("Helvetica")
           .fontSize(8)
           .text(`${categoryLabel} | ${snLabel}`, x + 12, y + 114, { width: 264, align: "center", ellipsis: true, height: 12 });
      }
    });

    doc.end();

    const pdfBuffer = await drawPromise;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=\"asset-tags.pdf\"",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
