import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest,res: NextResponse){
    
    try {
        const body = await req.json();
    const {file_key,file_name} = body;
        return NextResponse.json({chat_id:"123"},{status:200})
    } catch (error) {
        console.log(error);
        return NextResponse.json({error:"Internal Server Error"},{status:500})
    }
}