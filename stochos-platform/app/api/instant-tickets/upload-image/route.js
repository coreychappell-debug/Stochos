import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a unique filename
    const fileExtension = path.extname(file.name) || '.png';
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
    const filename = `ticket_${hash}${fileExtension}`;

    // Target directory
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'tickets');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (e) {}

    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/tickets/${filename}`;
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('Error in ticket image upload API:', error);
    return NextResponse.json({ error: 'Failed to upload ticket image', details: error.message }, { status: 500 });
  }
}
