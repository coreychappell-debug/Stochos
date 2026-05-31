import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validatePipeline } from '@/lib/validators/pipeline';

export async function GET(request) {
  try {
    const pipelines = await prisma.pipeline.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ success: true, pipelines });
  } catch (error) {
    console.error('Error fetching pipelines:', error);
    return NextResponse.json({ error: 'Failed to fetch pipelines', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, description, pipelineJson, organizationId, createdBy } = body;
    
    if (!name || !pipelineJson) {
      return NextResponse.json({ error: 'Missing required fields (name, pipelineJson)' }, { status: 400 });
    }

    const isValid = validatePipeline(pipelineJson);
    if (!isValid) {
      return NextResponse.json({ 
        error: 'Invalid pipeline configuration schema', 
        details: validatePipeline.errors 
      }, { status: 400 });
    }

    const orgId = organizationId || 'default-org';
    const creator = createdBy || 'system';

    const pipeline = await prisma.pipeline.create({
      data: {
        organizationId: orgId,
        name,
        description,
        pipelineJson,
        createdBy: creator
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Pipeline published successfully.',
      pipeline
    });

  } catch (error) {
    console.error('Error creating pipeline:', error);
    return NextResponse.json({ error: 'Failed to save pipeline', details: error.message }, { status: 500 });
  }
}
