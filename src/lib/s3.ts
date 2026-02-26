import { S3Client } from "@aws-sdk/client-s3";

if (!process.env.S3_ENDPOINT || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME) {
    console.warn("Missing S3 configuration in environment variables.");
}

export const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.S3_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

console.log("S3 Client initialized with key starting with:", process.env.AWS_ACCESS_KEY_ID?.substring(0, 4));

export const BUCKET_NAME = process.env.S3_BUCKET_NAME!;
