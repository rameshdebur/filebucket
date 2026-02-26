import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { s3, BUCKET_NAME } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

// Increase body size limit for file uploads (50MB)
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ binId: string }> }) {
    try {
        const resolvedParams = await params;
        const binId = resolvedParams.binId;

        // Verify bucket exists and is active
        const bucket = await prisma.bucket.findUnique({
            where: { id: binId, status: "ACTIVE" },
        });

        if (!bucket || new Date() > bucket.expiresAt) {
            return NextResponse.json({ error: "Bucket not found or expired" }, { status: 404 });
        }

        // Parse the FormData from the request
        const formData = await req.formData();
        const uploadedFiles = formData.getAll("files") as File[];

        if (!uploadedFiles || uploadedFiles.length === 0) {
            return NextResponse.json({ error: "No files provided" }, { status: 400 });
        }

        const results = [];

        for (const file of uploadedFiles) {
            const fileId = crypto.randomUUID();
            const s3Key = `${bucket.id}/${fileId}-${file.name}`;

            // Read file into buffer and upload to S3 server-side
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: s3Key,
                Body: buffer,
                ContentType: file.type || "application/octet-stream",
                ContentLength: buffer.length,
            });

            await s3.send(command);

            // Save file record to Database
            await prisma.file.create({
                data: {
                    id: fileId,
                    bucketId: bucket.id,
                    s3Key,
                    filename: file.name,
                    size: buffer.length,
                    mimeType: file.type || "application/octet-stream",
                }
            });

            results.push({
                fileId,
                filename: file.name,
                size: buffer.length,
            });
        }

        return NextResponse.json({ uploaded: results }, { status: 200 });

    } catch (error) {
        console.error("Error uploading files:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
