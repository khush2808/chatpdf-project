import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // TODO: Implement PDF processing and chat creation
    console.log("Create chat API called - PDF processing not yet implemented");

    return NextResponse.json(
      {
        success: false,
        message: "PDF processing functionality will be implemented soon",
      },
      { status: 501 }
    ); // 501 Not Implemented
  } catch (error) {
    console.error("Error in create-chat API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
