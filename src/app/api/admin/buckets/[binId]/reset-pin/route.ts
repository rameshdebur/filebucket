import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_MASTER_PIN = process.env.ADMIN_MASTER_PIN || "000000";

export async function POST(req: Request, { params }: { params: Promise<{ binId: string }> }) {
    try {
        // Basic auth check
        const authPin = req.headers.get("X-Admin-Pin");

        if (authPin !== ADMIN_MASTER_PIN) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const resolvedParams = await params;
        const binId = resolvedParams.binId;

        const bucket = await prisma.bucket.findUnique({
            where: { id: binId },
        });

        if (!bucket) {
            return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
        }

        // Generate a new 6-digit PIN
        const newPin = Math.floor(100000 + Math.random() * 900000).toString();

        const updatedBucket = await prisma.bucket.update({
            where: { id: binId },
            data: { pin: newPin }
        });

        return NextResponse.json({ message: "PIN reset successfully", newPin: updatedBucket.pin }, { status: 200 });

    } catch (error) {
        console.error("Error resetting PIN:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
