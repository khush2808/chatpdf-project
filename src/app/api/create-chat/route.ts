import { loads3IntoPinecone } from "@/lib/pinecone";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest,res: NextResponse){
    
    try {
        const body = await req.json();
    const {file_key,file_name} = body;
       await loads3IntoPinecone(file_key,file_name)
       return NextResponse.json({message:"Success"},{status:200})
    } catch (error) {
        console.log(error);
        return NextResponse.json({error:"Internal Server Error"},{status:500})
    }
}