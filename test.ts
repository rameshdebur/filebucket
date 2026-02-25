import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const bucket = await prisma.bucket.create({
        data: {
            folderName: "TestBucket",
            pin: "123456",
            expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
        }
    })
    console.log("Created bucket:", bucket)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
