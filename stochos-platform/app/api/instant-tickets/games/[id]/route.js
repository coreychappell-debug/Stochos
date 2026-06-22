import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  try {
    const updateData = {};
    if (body.deliveryStatus !== undefined) {
      updateData.deliveryStatus = body.deliveryStatus.toLowerCase();
    }
    if (body.isReorder !== undefined) {
      updateData.isReorder = !!body.isReorder;
    }
    if (body.imageUrl !== undefined) {
      updateData.imageUrl = body.imageUrl || null;
    }
    if (body.launchDate !== undefined) {
      updateData.launchDate = body.launchDate ? new Date(body.launchDate) : null;
    }
    if (body.closeDate !== undefined) {
      updateData.closeDate = body.closeDate ? new Date(body.closeDate) : null;
    }

    const updatedGame = await prisma.instantTicketGame.update({
      where: { id },
      data: updateData,
    });

    const serializedGame = JSON.parse(
      JSON.stringify(updatedGame, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json({ success: true, game: serializedGame });
  } catch (error) {
    console.error("Error updating game:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
