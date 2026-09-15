import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Users:', JSON.stringify(users, null, 2));
  
  for (const user of users) {
    if (user.plan === 'FREE') {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { plan: 'PRO' }
      });
      console.log(`Upgraded user ${user.email} to PRO`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
