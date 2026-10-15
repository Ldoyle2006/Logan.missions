import { randomBytes, scryptSync } from "node:crypto";
// Pipe a chosen password through stdin, or omit stdin to generate a strong one.
// No password is accepted in command arguments or written to disk.
let input = "";
if (!process.stdin.isTTY) for await (const chunk of process.stdin) input += chunk;
const password = input.trim() || randomBytes(24).toString("base64url");
if (password.length < 16) throw new Error("Use at least 16 characters for the admin password.");
const salt = randomBytes(16).toString("hex");
if (!input.trim()) console.log(`Save this generated password in your password manager: ${password}`);
console.log(`SCHOOL_ADMIN_PASSWORD_HASH=${salt}:${scryptSync(password, salt, 64).toString("hex")}`);
