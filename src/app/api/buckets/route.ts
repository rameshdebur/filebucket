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
        // Generate a unique 4-digit PIN — ensure no collision with any active, unexpired bucket
        let pin: string = "";
        let attempts = 0;
        while (attempts < 20) {
            const candidate = Math.floor(1000 + Math.random() * 9000).toString();
            const existing = await prisma.bucket.findFirst({
                where: {
                    pin: candidate,
                    status: "ACTIVE",
                    expiresAt: { gt: new Date() },
                },
                select: { id: true },
            });
            if (!existing) {
                pin = candidate;
                break;
            }
            attempts++;
        }

        if (!pin) {
            // Extremely unlikely — all 9000 PINs exhausted
            return NextResponse.json({ error: "No available PINs. Try again later." }, { status: 503 });
        }

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
