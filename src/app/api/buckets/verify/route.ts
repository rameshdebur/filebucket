import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { pin } = body;

        if (!pin || typeof pin !== "string" || pin.length !== 6) {
            return NextResponse.json({ error: "Invalid PIN format" }, { status: 400 });
        }

        const bucket = await prisma.bucket.findFirst({
            where: {
                pin: pin,
                status: "ACTIVE",
            },
        });

        if (!bucket) {
            return NextResponse.json({ error: "Bucket not found or PIN is incorrect" }, { status: 404 });
        }

        if (new Date() > bucket.expiresAt) {
            return NextResponse.json({ error: "This bucket has expired" }, { status: 410 });
        }

        return NextResponse.json({
            bucketId: bucket.id,
            folderName: bucket.folderName,
            createdAt: bucket.createdAt,
            expiresAt: bucket.expiresAt,
        }, { status: 200 });

    } catch (error) {
        console.error("Error verifying PIN:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
