import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_MASTER_PIN = process.env.ADMIN_MASTER_PIN || "000000";

export async function GET(req: Request) {
    try {
        // Basic auth check using a header "X-Admin-Pin"
        const authPin = req.headers.get("X-Admin-Pin");

        if (authPin !== ADMIN_MASTER_PIN) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search'); // Optional search by folderName

        const whereClause: Record<string, unknown> = { status: "ACTIVE" };

        if (search && search.trim() !== '') {
            whereClause.folderName = { contains: search }; // SQLite contains is case-insensitive by default in some PRISMA versions, but generally useful
        }

        const buckets = await prisma.bucket.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                folderName: true,
                pin: true,
                createdAt: true,
                expiresAt: true,
                _count: {
                    select: { files: true }
                }
            }
        });

        return NextResponse.json({ buckets }, { status: 200 });

    } catch (error: unknown) {
        console.error("Error retrieving admin buckets:", error as Error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
