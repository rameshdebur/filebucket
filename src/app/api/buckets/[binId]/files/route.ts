import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { s3, BUCKET_NAME } from "@/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function GET(req: Request, { params }: { params: Promise<{ binId: string }> }) {
    try {
        const resolvedParams = await params;
        const binId = resolvedParams.binId;

        const bucket = await prisma.bucket.findUnique({
            where: { id: binId },
            include: { files: true },
        });

        if (!bucket || bucket.status !== "ACTIVE" || new Date() > bucket.expiresAt) {
            return NextResponse.json({ error: "Bucket not found or expired" }, { status: 404 });
        }

        const filesWithUrls = await Promise.all(
            bucket.files.map(async (file: { id: string; filename: string; size: number; mimeType: string; s3Key: string }) => {
                const command = new GetObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: file.s3Key,
                    ResponseContentDisposition: `attachment; filename="${file.filename}"`,
                });

                // URL expires in 1 hour
                const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

                return {
                    id: file.id,
                    filename: file.filename,
                    size: file.size,
                    mimeType: file.mimeType,
                    downloadUrl,
                };
            })
        );

        return NextResponse.json({ files: filesWithUrls }, { status: 200 });

    } catch (error) {
        console.error("Error retrieving files:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
