import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Simple in-memory rate limiter: 5 attempts per IP per 60 seconds
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = attempts.get(ip);

    if (!entry || now > entry.resetAt) {
        attempts.set(ip, { count: 1, resetAt: now + 60_000 });
        return false;
    }

    if (entry.count >= 10) return true;

    entry.count++;
    return false;
}

export async function POST(req: Request) {
    try {
        // Rate limit by IP
        const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
        if (isRateLimited(ip)) {
            return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
        }

        const body = await req.json();
        const { pin } = body;

        if (!pin || typeof pin !== "string" || pin.length !== 4) {
            return NextResponse.json({ error: "Invalid PIN format" }, { status: 400 });
        }

        const bucket = await prisma.bucket.findFirst({
            where: { pin, status: "ACTIVE" },
        });

        if (!bucket) {
            return NextResponse.json({ error: "Bucket not found or PIN is incorrect" }, { status: 404 });
        }

        if (new Date() > bucket.expiresAt) {
            return NextResponse.json({ error: "This bucket has expired" }, { status: 410 });
        }

        return NextResponse.json({
            bucketId: bucket.id,
            folderName: bucket.folderName,
            createdAt: bucket.createdAt,
            expiresAt: bucket.expiresAt,
        }, { status: 200 });

    } catch (error) {
        console.error("Error verifying PIN:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
