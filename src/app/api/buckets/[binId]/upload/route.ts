import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { s3, BUCKET_NAME } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

export async function POST(req: Request, { params }: { params: Promise<{ binId: string }> }) {
    try {
        const body = await req.json();
        const { files } = body; // Array of { filename, mimeType, size }

        if (!files || !Array.isArray(files) || files.length === 0) {
            return NextResponse.json({ error: "Files array is required" }, { status: 400 });
        }

        const resolvedParams = await params;
        const binId = resolvedParams.binId;

        // Verify bucket exists and is active
        const bucket = await prisma.bucket.findUnique({
            where: { id: binId, status: "ACTIVE" },
        });

        if (!bucket || new Date() > bucket.expiresAt) {
            return NextResponse.json({ error: "Bucket not found or expired" }, { status: 404 });
        }

        const presignedUrls = [];

        // Process each file to generate a presigned URL and save it to DB
        for (const file of files) {
            const { filename, mimeType, size } = file;

            // Generate a unique S3 key
            const fileId = crypto.randomUUID();
            const s3Key = `${bucket.id}/${fileId}-${filename}`;

            // Create command for upload — keep signed headers minimal for R2 compatibility
            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: s3Key,
            });

            // Generate presigned URL (valid for 15 minutes)
            // unhoistableHeaders prevents SDK from adding x-amz-checksum headers that R2 rejects
            const uploadUrl = await getSignedUrl(s3, command, {
                expiresIn: 900,
                unhoistableHeaders: new Set(["x-amz-checksum-crc32"]),
            });

            // Save file record to Database
            await prisma.file.create({
                data: {
                    id: fileId,
                    bucketId: bucket.id,
                    s3Key,
                    filename,
                    size,
                    mimeType,
                }
            });

            presignedUrls.push({
                fileId,
                filename,
                uploadUrl,
            });
        }

        return NextResponse.json({ presignedUrls }, { status: 200 });

    } catch (error) {
        console.error("Error generating presigned URLs:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
