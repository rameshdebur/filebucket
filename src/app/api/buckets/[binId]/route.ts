import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { s3, BUCKET_NAME } from "@/lib/s3";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

export async function DELETE(req: Request, { params }: { params: Promise<{ binId: string }> }) {
    try {
        const resolvedParams = await params;
        const binId = resolvedParams.binId;

        const bucket = await prisma.bucket.findUnique({
            where: { id: binId },
            include: { files: true },
        });

        if (!bucket) {
            return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
        }

        // Delete files from S3
        const deletePromises = bucket.files.map(async (file: { s3Key: string }) => {
            try {
                const command = new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: file.s3Key,
                });
                await s3.send(command);
            } catch (s3Error) {
                console.error(`Failed to delete S3 object ${file.s3Key}:`, s3Error);
            }
        });

        await Promise.allSettled(deletePromises);

        // Delete files records and update bucket status
        await prisma.$transaction([
            prisma.file.deleteMany({ where: { bucketId: binId } }),
            prisma.bucket.update({
                where: { id: binId },
                data: { status: "CLOSED" }
            })
        ]);

        return NextResponse.json({ message: "Bucket destroyed successfully" }, { status: 200 });

    } catch (error) {
        console.error("Error destroying bucket:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
