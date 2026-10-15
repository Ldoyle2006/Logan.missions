import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
const scryptAsync = promisify(scrypt);
const digest = value => createHash("sha256").update(value).digest("hex");

export function createAdminAuth(passwordHash, siteOrigin) {
  const sessions = new Map();
  const attempts = new Map();
  const configured = /^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(passwordHash || "") && Boolean(siteOrigin);
  const secure = siteOrigin?.startsWith("https://");
  const cookieName = secure ? "__Host-school_admin" : "school_admin";
  function cookie(token, age) { return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? "; Secure" : ""}`; }
  function sessionKey(request) {
    const value = request.headers.cookie?.split(";").map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    return value && /^[a-f0-9]{64}$/.test(value) ? digest(value) : null;
  }
  function authenticated(request) {
    const now = Date.now();
    for (const [key, expires] of sessions) if (expires <= now) sessions.delete(key);
    return Boolean(sessions.get(sessionKey(request)) > now);
  }
  return { configured, authenticated,
    sameOrigin: request => Boolean(siteOrigin && request.headers.origin === siteOrigin),
    async login(request, password) {
      if (!configured) return { status: 503, message: "Private administration has not been configured." };
      const ip = request.socket.remoteAddress || "unknown";
      const now = Date.now();
      for (const [key, attempt] of attempts) if (attempt.until <= now) attempts.delete(key);
      const entry = attempts.get(ip) || { count: 0, until: now + 15 * 60_000 };
      attempts.set(ip, entry);
      if (++entry.count > 5) return { status: 429, message: "Too many login attempts. Try again in 15 minutes." };
      if (typeof password !== "string" || password.length > 1024) return { status: 401, message: "Login unsuccessful." };
      const [salt, hash] = passwordHash.split(":");
      const supplied = await scryptAsync(password, salt, 64);
      if (!timingSafeEqual(supplied, Buffer.from(hash, "hex"))) return { status: 401, message: "Login unsuccessful." };
      const token = randomBytes(32).toString("hex");
      sessions.set(digest(token), now + 60 * 60_000);
      return { status: 200, message: "Signed in.", cookie: cookie(token, 3600) };
    },
    logout(request) { sessions.delete(sessionKey(request)); return cookie("", 0); },
  };
}
