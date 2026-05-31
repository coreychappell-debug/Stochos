// lib/metricRegistry.ts
/**
 * Core services for Metric Registry and Calculation Engine.
 * Uses Prisma client for persistence.
 */
import { MetricDefinition, MetricCalculation } from '@prisma/client';
import { detectCycle } from './dagValidator';
import { prisma } from './db';

/** Create a new metric definition */
export async function createMetric(data: {
  name: string;
  glAccount?: string;
  dimensions?: any;
  ownerUserId: string;
  effectiveStartDate: Date;
  effectiveEndDate?: Date;
  numberFormat?: string;
}): Promise<MetricDefinition> {
  return prisma.metricDefinition.create({
    data: {
      name: data.name,
      glAccount: data.glAccount,
      dimensions: data.dimensions ?? undefined,
      ownerUserId: data.ownerUserId,
      effectiveStartDate: data.effectiveStartDate,
      effectiveEndDate: data.effectiveEndDate,
      numberFormat: data.numberFormat,
    },
  });
}

/** Create or update a metric calculation version */
export async function upsertMetricCalculation(params: {
  metricDefinitionId: string;
  version: number;
  expression: string;
  aggregationBehavior?: string;
  dependencyMetrics?: string[]; // list of metricDefinition IDs
  effectiveStartDate: Date;
  effectiveEndDate?: Date;
  createdById: string;
}): Promise<MetricCalculation> {
  // Fetch the current/active calculations for all metrics to construct the dependency graph
  const activeCalcs = await prisma.metricCalculation.findMany({
    where: { isCurrent: true },
    select: { metricDefinitionId: true, dependencyMetrics: true }
  });

  const graph: Record<string, string[]> = {};
  for (const calc of activeCalcs) {
    const deps = (calc.dependencyMetrics as unknown as string[]) ?? [];
    graph[calc.metricDefinitionId] = deps;
  }

  // Inject or overwrite the proposed calculation dependencies for the target metric
  graph[params.metricDefinitionId] = params.dependencyMetrics ?? [];

  if (detectCycle(graph)) {
    throw new Error('Circular dependency detected in metric calculation graph');
  }

  return prisma.metricCalculation.upsert({
    where: {
      metricDefinitionId_version: {
        metricDefinitionId: params.metricDefinitionId,
        version: params.version,
      },
    },
    create: {
      metricDefinitionId: params.metricDefinitionId,
      version: params.version,
      expression: params.expression,
      aggregationBehavior: params.aggregationBehavior,
      dependencyMetrics: params.dependencyMetrics ?? undefined,
      effectiveStartDate: params.effectiveStartDate,
      effectiveEndDate: params.effectiveEndDate,
      createdById: params.createdById,
    },
    update: {
      expression: params.expression,
      aggregationBehavior: params.aggregationBehavior,
      dependencyMetrics: params.dependencyMetrics ?? undefined,
      effectiveStartDate: params.effectiveStartDate,
      effectiveEndDate: params.effectiveEndDate,
    },
  });
}

/** Approve a calculation to become current */
export async function approveCalculation(params: { id: string; approvedById: string }): Promise<MetricCalculation> {
  const calc = await prisma.metricCalculation.findUnique({ where: { id: params.id } });
  if (!calc) throw new Error('Calculation not found');
  if (calc.createdById === params.approvedById) {
    throw new Error('Approval must be performed by a different user than the creator');
  }
  
  return prisma.$transaction(async (tx: any) => {
    // 1. Deactivate isCurrent status on all other versions for this metric definition
    await tx.metricCalculation.updateMany({
      where: { metricDefinitionId: calc.metricDefinitionId },
      data: { isCurrent: false }
    });

    // 2. Activate isCurrent status on this specific version
    return tx.metricCalculation.update({
      where: { id: params.id },
      data: { isCurrent: true, approvedById: params.approvedById },
    });
  });
}
