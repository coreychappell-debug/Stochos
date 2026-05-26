import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: contractId } = await params;

  try {
    const accessList = await prisma.contractAccess.findMany({
      where: { contractId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    const allUsers = await prisma.user.findMany({
      where: { status: "active" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ accessList, allUsers });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: contractId } = await params;

  try {
    const body = await request.json();
    if (!body.userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const access = await prisma.contractAccess.upsert({
      where: {
        contractId_userId: {
          contractId,
          userId: body.userId,
        },
      },
      update: {
        permission: body.permission || "read",
      },
      create: {
        contractId,
        userId: body.userId,
        permission: body.permission || "read",
      },
      include: { user: { select: { name: true, email: true } } },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "contract",
        entityId: contractId,
        action: "grant_access",
        changes: { userId: body.userId, name: access.user.name, permission: access.permission },
      },
    });

    return NextResponse.json(access);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: contractId } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    await prisma.contractAccess.delete({
      where: {
        contractId_userId: {
          contractId,
          userId,
        },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "contract",
        entityId: contractId,
        action: "revoke_access",
        changes: { userId, name: user?.name || "Unknown" },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
