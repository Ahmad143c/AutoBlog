
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('Recent Posts:', JSON.stringify(posts, null, 2));

  const workflows = await prisma.workflow.findMany({
    orderBy: { lastRunAt: 'desc' },
    take: 5
  });
  console.log('Recent Workflow Runs:', JSON.stringify(workflows, null, 2));
  
  await prisma.$disconnect();
}

check();
