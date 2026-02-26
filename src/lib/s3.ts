import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

if (!process.env.S3_ENDPOINT || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME) {
    console.warn("Missing S3 configuration in environment variables.");
}

export const s3 = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT!,
    // Railway Buckets use virtual-hosted-style URLs
    forcePathStyle: false,
    // Disable automatic checksums — Railway doesn't support them
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

export const BUCKET_NAME = process.env.S3_BUCKET_NAME!;

/**
 * Configure CORS on the bucket at startup — same approach as attendance-light.
 * This allows browser-direct presigned URL uploads without CORS errors.
 */
export async function configureBucketCors() {
    try {
        await s3.send(new PutBucketCorsCommand({
            Bucket: BUCKET_NAME,
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: ["*"],
                        AllowedMethods: ["GET", "HEAD", "PUT", "POST", "DELETE"],
                        AllowedOrigins: ["*"],
                        ExposeHeaders: ["ETag"],
                        MaxAgeSeconds: 3000,
                    },
                ],
            },
        }));
        console.log(`✓ CORS configured on bucket: ${BUCKET_NAME}`);
    } catch (err) {
        console.warn("⚠ Could not configure CORS on bucket (may not be supported):", err);
    }
}
