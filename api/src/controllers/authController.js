import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User } from "../models/userModel.js";
import {
  assertPasswordResetEmailConfigured,
  sendPasswordResetEmail
} from "../services/passwordResetEmail.js";
import { HttpError } from "../utils/httpError.js";

const passwordResetTokenLifetimeMs = 15 * 60 * 1000;

function makeAccessToken(user) {
  return jwt.sign(
    { email: user.email, tokenVersion: user.tokenVersion },
    config.jwtSecret,
    { subject: user.id, expiresIn: "1h" }
  );
}

export async function register(req, res) {
  const name = req.body?.name;
  const rawEmail = req.body?.email;
  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : undefined;
  const password = req.body?.password;

  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    throw new HttpError(400, "Name must be between 1 and 100 characters.");
  }

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "A valid email is required.");
  }

  if (
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new HttpError(400, "Password must be 8–72 bytes long.");
  }

  if (User.findByEmail(email)) {
    throw new HttpError(409, "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = User.create({ name: name.trim(), email, passwordHash });

  if (!user) {
    throw new HttpError(409, "An account with this email already exists.");
  }

  res.status(201).json({
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token: makeAccessToken(user)
    }
  });
}

export async function login(req, res) {
  const rawEmail = req.body?.email;
  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : undefined;
  const password = req.body?.password;

  if (typeof email !== "string" || typeof password !== "string") {
    throw new HttpError(400, "Email and password are required.");
  }

  const user = User.findByEmail(email);
  const passwordMatches = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  if (!passwordMatches) {
    throw new HttpError(401, "Email or password is incorrect.");
  }

  res.json({
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token: makeAccessToken(user)
    }
  });
}
/*
export async function requestPasswordReset(req, res) {
  const rawEmail = req.body?.email;
  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : undefined;

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "A valid email is required.");
  }

  assertPasswordResetEmailConfigured();

  const user = User.findByEmail(email);
  if (user) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      Date.now() + passwordResetTokenLifetimeMs
    ).toISOString();
    const tokenHash = User.createPasswordResetToken(user.id, token, expiresAt);

    try {
      await sendPasswordResetEmail(user.email, token);
    } catch (error) {
      User.deletePasswordResetToken(tokenHash);
      throw error;
    }
  }

  res.status(202).json({
    data: {
      message: "If an account exists for that email, reset instructions were sent."
    }
  });
}

export async function resetPassword(req, res) {
  const token = req.body?.token;
  const password = req.body?.newPassword;

  if (typeof token !== "string" || !token) {
    throw new HttpError(400, "A password reset token is required.");
  }

  if (
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new HttpError(400, "Password must be 8–72 bytes long.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  if (!User.resetPassword(token, passwordHash)) {
    throw new HttpError(400, "The password reset token is invalid or expired.");
  }

  res.json({ data: { message: "Password has been reset." } });
  
} */
