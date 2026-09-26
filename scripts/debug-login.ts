// Quick diagnostic: confirms the admin user exists in Neon and the password hash works.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

(async () => {
  const user = await prisma.user.findUnique({ where: { email: 'admin@ruthex.local' } });
  if (!user) {
    console.log('USER_NOT_FOUND in database');
    process.exit(1);
  }
  console.log('user found:');
  console.log('  email        =', user.email);
  console.log('  role         =', user.role);
  console.log('  active       =', user.active);
  console.log('  passwordHash =', user.passwordHash.slice(0, 7) + '...' + user.passwordHash.slice(-4));
  console.log('  hashLength   =', user.passwordHash.length);

  const ok = await bcrypt.compare('Ruthex@2026', user.passwordHash);
  console.log('  bcrypt.compare(Ruthex@2026) =', ok);

  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
