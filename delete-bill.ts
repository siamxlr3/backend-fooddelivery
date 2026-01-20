import { PrismaClient } from './src/generated/prisma/client.js';

const prisma = new PrismaClient();

async function deleteBill() {
    try {
        // Try to delete by invoice number first
        const result = await prisma.bill.deleteMany({
            where: {
                invoiceNumber: '#9c4b7733'
            }
        });

        if (result.count > 0) {
            console.log(`✅ Successfully deleted ${result.count} bill(s) with invoice number #9c4b7733`);
        } else {
            console.log('❌ No bill found with invoice number #9c4b7733');

            // Try to find and delete by ID if it's a numeric ID
            const billId = parseInt('#9c4b7733'.replace('#', ''), 16);
            console.log(`Trying to delete by ID: ${billId}`);

            const billById = await prisma.bill.delete({
                where: { id: billId }
            }).catch(() => null);

            if (billById) {
                console.log(`✅ Successfully deleted bill with ID ${billId}`);
            } else {
                console.log('❌ No bill found with that ID either');
            }
        }
    } catch (error: any) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

deleteBill();
