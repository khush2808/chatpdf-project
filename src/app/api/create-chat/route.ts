import { NextRequest } from "next/server";

export async function POST(req: NextRequest,res: NextResponse){
    
    try {
        const body = await req.json();
    const {file_key,file_name} = body;

        const chat = await db.insert(chats).values({
    } catch (error) {
        
    }
}