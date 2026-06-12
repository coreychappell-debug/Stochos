import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    let calendars = await prisma.fiscalCalendar.findMany({
      include: { deadlines: { orderBy: { deadlineDate: 'asc' } } }
    });

    // Seed default statutory deadlines if none exist
    if (calendars.length === 0) {
      const defaultCal = await prisma.fiscalCalendar.create({
        data: {
          name: 'New York Lottery Statutory Calendar',
          fiscalYearStartMonth: 7, // July
          isActive: true
        }
      });

      // Statutory close deadline definitions
      const deadlinesData = [
        { calendarId: defaultCal.id, name: 'Q1 Statutory Statement Close', deadlineDate: new Date('2024-11-15'), frequency: 'quarterly', status: 'pending' },
        { calendarId: defaultCal.id, name: 'Q2 Statutory Statement Close', deadlineDate: new Date('2025-02-15'), frequency: 'quarterly', status: 'pending' },
        { calendarId: defaultCal.id, name: 'Q3 Statutory Statement Close', deadlineDate: new Date('2025-05-15'), frequency: 'quarterly', status: 'pending' },
        { calendarId: defaultCal.id, name: 'FY24 Annual ACFR Statutory Submission', deadlineDate: new Date('2024-12-31'), frequency: 'annual', status: 'completed' }
      ];

      await prisma.reportingDeadline.createMany({
        data: deadlinesData
      });

      calendars = await prisma.fiscalCalendar.findMany({
        include: { deadlines: { orderBy: { deadlineDate: 'asc' } } }
      });
    }

    return NextResponse.json({ success: true, calendars });
  } catch (error) {
    console.error('Error fetching calendar info:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar close information', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { calendarId, name, deadlineDateStr, frequency } = body;

    if (!calendarId || !name || !deadlineDateStr) {
      return NextResponse.json({ error: 'Missing required parameters (calendarId, name, deadlineDateStr)' }, { status: 400 });
    }

    const deadline = await prisma.reportingDeadline.create({
      data: {
        calendarId,
        name,
        deadlineDate: new Date(deadlineDateStr),
        frequency: frequency || 'quarterly',
        status: 'pending'
      }
    });

    return NextResponse.json({ success: true, deadline });
  } catch (error) {
    console.error('Error creating statutory deadline:', error);
    return NextResponse.json({ error: 'Failed to create statutory deadline', details: error.message }, { status: 500 });
  }
}
