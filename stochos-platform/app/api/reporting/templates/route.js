import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jurisdictionId = searchParams.get('jurisdictionId');

    const templates = await prisma.reportTemplate.findMany({
      where: jurisdictionId ? { jurisdictionId } : undefined,
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { jurisdictionId, name, description, content, createdById } = body;

    if (!jurisdictionId || !name || !content || !createdById) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const template = await prisma.reportTemplate.create({
      data: {
        jurisdictionId,
        name,
        description,
        content,
        createdById
      }
    });

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
