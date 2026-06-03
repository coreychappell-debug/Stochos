import { NextResponse } from "next/server";
import logger from "@/lib/logger";

export async function POST(req) {
  try {
    const body = await req.json();
    
    // Log client error as an ERROR entry in our local log file
    logger.error(`Client JS crash: ${body.message}`, {
      url: body.url,
      userAgent: body.userAgent,
      stack: body.stack,
      componentStack: body.componentStack
    });
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to process client-side error report:", err);
    return NextResponse.json({ error: "Failed to log client error" }, { status: 500 });
  }
}
