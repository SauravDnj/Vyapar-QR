import 'dotenv/config';

import * as readline from 'node:readline';

import * as bcrypt from 'bcrypt';

import { JsonDbClient } from '../src/jsondb';

/**
 * Sets an account's password from the command line.
 *
 * The way back in when nobody can sign in: the Super Admin's own password is
 * lost, there is no second Super Admin, and "Forgot password" is useless
 * because sending email needs an SMTP server this deployment may not have.
 *
 * Run it where the database is reachable:
 *
 *   pnpm --filter api set-password owner@business.com
 *
 * It asks for the new password and does not echo it, so the password never
 * appears in the shell history or in a log. Pipe one in for scripting:
 *
 *   echo 'the-new-password' | pnpm --filter api set-password owner@business.com
 *
 * Against production, load that environment first (see docs/DEPLOYMENT.md):
 *   cd apps/api && vercel env pull .env.production.local
 *   set -a && . ./.env.production.local && set +a && JSONDB_DRIVER=redis pnpm set-password <email>
 */

const MIN_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

function askSecret(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    // Piped in: read one line.
    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin });
      rl.once('line', (line) => {
        rl.close();
        resolve(line.trim());
      });
    });
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Typing stays invisible: the prompt is written once and every keystroke
    // echo is swallowed.
    const output = rl as unknown as { output: NodeJS.WriteStream; _writeToOutput: (text: string) => void };
    const { _writeToOutput: write } = output;
    let asked = false;
    output._writeToOutput = function writeMasked(text: string) {
      if (!asked) {
        asked = true;
        write.call(this, text);
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: pnpm --filter api set-password <email>');
    process.exitCode = 1;
    return;
  }

  const prisma = new JsonDbClient();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const accounts = await prisma.user.findMany({ select: { email: true, role: true } });
    console.error(`No account with the email ${email}. This database has:`);
    for (const account of accounts) console.error(`  ${account.email}  (${account.role})`);
    process.exitCode = 1;
    return;
  }

  const password = await askSecret(`New password for ${email} (${user.role}): `);
  if (password.length < MIN_LENGTH) {
    console.error(`Too short — at least ${String(MIN_LENGTH)} characters.`);
    process.exitCode = 1;
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    // Clearing the stored session ends whatever was signed in with the old
    // password, the same as the Super Admin setting a client's password.
    data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS), hashedRefreshToken: null },
  });

  console.log(`Password changed for ${email}. Any signed-in session has been ended.`);
}

void main();
