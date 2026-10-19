// Creates the bcrypt hash for ADMIN_PASSWORD_HASH. Usage: npm run admin:hash
// The password is typed hidden, so it is not shown on screen or saved in your shell history.
import bcrypt from "bcryptjs";
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let muted = false;
rl._writeToOutput = (text) => {
  if (!muted) process.stdout.write(text);
};

process.stdout.write("New admin password (at least 12 characters): ");
muted = true;
rl.question("", async (password) => {
  muted = false;
  process.stdout.write("\n");
  rl.close();
  if (password.length < 12) {
    console.error("The password must be at least 12 characters. Nothing was printed.");
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  console.log("\nSet this as the ADMIN_PASSWORD_HASH environment variable in Vercel:\n");
  console.log(`${hash}\n`);
});
