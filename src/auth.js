import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "./models.js";
import { StockError } from "./errors.js";

const TOKEN_TTL = "7d";

function jwtSecret() {
  return process.env.JWT_SECRET || "shopstore-dev-secret";
}

export function authRequired() {
  const raw = String(process.env.REQUIRE_AUTH || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function presentUser(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
  };
}

function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, name: user.name },
    jwtSecret(),
    { expiresIn: TOKEN_TTL },
  );
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export async function signup({ name, email, password }) {
  const cleanName = String(name || "").trim();
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = String(password || "");

  if (!cleanName) throw new StockError("Enter the counter person's name.");
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new StockError("Enter a valid email.");
  }
  if (cleanPassword.length < 6) {
    throw new StockError("Password must be at least 6 characters.");
  }

  const existing = await User.findOne({ email: cleanEmail });
  if (existing) {
    throw new StockError("That email already has a ShopStore account.", 409);
  }

  const passwordHash = await bcrypt.hash(cleanPassword, 10);
  const user = await User.create({
    name: cleanName,
    email: cleanEmail,
    passwordHash,
  });
  return { user: presentUser(user), token: signToken(user) };
}

export async function login({ email, password }) {
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = String(password || "");
  if (!cleanEmail || !cleanPassword) {
    throw new StockError("Enter email and password.");
  }

  const user = await User.findOne({ email: cleanEmail });
  if (!user) throw new StockError("Wrong email or password.", 401);

  const ok = await bcrypt.compare(cleanPassword, user.passwordHash);
  if (!ok) throw new StockError("Wrong email or password.", 401);

  return { user: presentUser(user), token: signToken(user) };
}

export async function userFromToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret());
    const user = await User.findById(payload.sub);
    return user ? presentUser(user) : null;
  } catch {
    return null;
  }
}

export function readBearer(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export async function attachUser(req, _res, next) {
  try {
    const token = readBearer(req);
    req.user = token ? await userFromToken(token) : null;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req, res, next) {
  if (!authRequired()) {
    next();
    return;
  }
  if (req.path.startsWith("/auth/signup") || req.path.startsWith("/auth/login")) {
    next();
    return;
  }
  if (req.user) {
    next();
    return;
  }
  res.status(401).json({ error: "Sign in to use the stock book." });
}

export const DEMO_USER = {
  name: "Rohan Counter",
  email: "counter@shopstore.local",
  password: "shopstore123",
};

export async function seedDemoUser() {
  const email = DEMO_USER.email;
  const existing = await User.findOne({ email });
  if (existing) return { seeded: false, email };
  const passwordHash = await bcrypt.hash(DEMO_USER.password, 10);
  await User.create({
    name: DEMO_USER.name,
    email,
    passwordHash,
  });
  return { seeded: true, email };
}
