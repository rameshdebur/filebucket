import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { s3, BUCKET_NAME, configureBucketCors } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

export const runtime = "nodejs";

// Configure CORS on bucket once at cold start
let corsConfigured = false;
async function ensureCors() {
    if (!corsConfigured) {
        await configureBucketCors();
        corsConfigured = true;
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ binId: string }> }) {
    try {
        // Ensure CORS is set on the bucket so presigned uploads work from the browser
        await ensureCors();

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

        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

        for (const file of files) {
            const { filename, mimeType, size } = file;

            if (size > MAX_FILE_SIZE) {
                return NextResponse.json(
                    { error: `File "${filename}" exceeds the 100 MB limit (${(size / 1024 / 1024).toFixed(1)} MB).` },
                    { status: 413 }
                );
            }

            const fileId = crypto.randomUUID();
            const s3Key = `${bucket.id}/${fileId}-${filename}`;

            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: s3Key,
                ContentType: mimeType || "application/octet-stream",
            });

            // Generate presigned URL valid for 15 minutes
            const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

            // Save file record to DB
            await prisma.file.create({
                data: {
                    id: fileId,
                    bucketId: bucket.id,
                    s3Key,
                    filename,
                    size,
                    mimeType: mimeType || "application/octet-stream",
                }
            });

            presignedUrls.push({ fileId, filename, uploadUrl });
        }

        return NextResponse.json({ presignedUrls }, { status: 200 });

    } catch (error) {
        console.error("Error generating presigned URLs:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
