import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addHours } from "date-fns";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { folderName } = body;

        if (!folderName || typeof folderName !== "string" || folderName.trim().length === 0) {
            return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
        }

        // Generate a 6-digit PIN securely
        const pin = Math.floor(100000 + Math.random() * 900000).toString();

        let expiresAt = addHours(new Date(), 72); // Default 72 hours expiry
        let finalFolderName = folderName.trim();

        // Magic Word Parsing (Case Insensitive)
        // Check for 'RDV' first (longest expiry)
        if (/RDV/i.test(finalFolderName)) {
            expiresAt = addHours(new Date(), 24 * 90); // 90 days
            finalFolderName = finalFolderName.replace(/RDV/i, "").trim();
        }
        // Then check for 'RCP'
        else if (/RCP/i.test(finalFolderName)) {
            expiresAt = addHours(new Date(), 24 * 30); // 30 days
            finalFolderName = finalFolderName.replace(/RCP/i, "").trim();
        }

        // Clean up any double spaces left behind
        finalFolderName = finalFolderName.replace(/\s+/g, ' ').trim();

        const bucket = await prisma.bucket.create({
            data: {
                folderName: finalFolderName,
                pin,
                expiresAt,
            },
        });

        return NextResponse.json(
            {
                bucketId: bucket.id,
                folderName: bucket.folderName,
                pin: bucket.pin,
                expiresAt: bucket.expiresAt,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Error creating bucket:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
