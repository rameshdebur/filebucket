import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { s3, BUCKET_NAME } from "@/lib/s3";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";

export async function GET(req: Request) {
    try {
        // Optional: Secure this endpoint using a cron secret header
        const authHeader = req.headers.get("Authorization");
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const now = new Date();

        // 1. Find all expired buckets
        const expiredBuckets = await prisma.bucket.findMany({
            where: {
                expiresAt: { lt: now }
            },
            include: { files: true }
        });

        if (expiredBuckets.length === 0) {
            return NextResponse.json({ message: "No expired buckets found" }, { status: 200 });
        }

        let deletedFilesCount = 0;

        // 2. Iterate through buckets, delete files from S3, then delete from DB
        for (const bucket of expiredBuckets) {
            if (bucket.files.length > 0) {
                // Prepare S3 Delete Command
                const s3Objects = bucket.files.map(f => ({ Key: f.s3Key }));

                const deleteCmd = new DeleteObjectsCommand({
                    Bucket: BUCKET_NAME,
                    Delete: { Objects: s3Objects, Quiet: true }
                });

                try {
                    await s3.send(deleteCmd);
                    deletedFilesCount += s3Objects.length;
                } catch (s3Error) {
                    console.error(`Failed to delete S3 objects for bucket ${bucket.id}:`, s3Error);
                    // Continue to next bucket if S3 fails, don't delete DB record yet
                    continue;
                }
            }

            // 3. Delete bucket from DB (Prisma cascade will delete file records)
            await prisma.bucket.delete({
                where: { id: bucket.id }
            });
        }

        return NextResponse.json({
            message: "Cleanup complete",
            bucketsRemoved: expiredBuckets.length,
            filesRemoved: deletedFilesCount
        }, { status: 200 });

    } catch (error) {
        console.error("Cron Purge Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
