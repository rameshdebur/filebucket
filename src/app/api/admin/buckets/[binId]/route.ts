import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { s3, BUCKET_NAME } from "@/lib/s3";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";

const ADMIN_MASTER_PIN = process.env.ADMIN_MASTER_PIN || "000000";

export async function DELETE(req: Request, { params }: { params: Promise<{ binId: string }> }) {
    try {
        const authPin = req.headers.get("X-Admin-Pin");
        if (authPin !== ADMIN_MASTER_PIN) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const resolvedParams = await params;
        const binId = resolvedParams.binId;

        const bucket = await prisma.bucket.findUnique({
            where: { id: binId },
            include: { files: true },
        });

        if (!bucket) {
            return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
        }

        // Delete all files from S3 first
        if (bucket.files.length > 0) {
            const s3Objects = bucket.files.map(f => ({ Key: f.s3Key }));
            await s3.send(new DeleteObjectsCommand({
                Bucket: BUCKET_NAME,
                Delete: { Objects: s3Objects, Quiet: true },
            }));
        }

        // Delete from DB (cascade removes file records)
        await prisma.bucket.delete({ where: { id: binId } });

        return NextResponse.json({ message: "Bucket deleted successfully" }, { status: 200 });

    } catch (error) {
        console.error("Error deleting bucket:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
