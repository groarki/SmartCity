import { createHash, randomUUID } from "node:crypto";

export class User {
  static #byId = new Map();
  static #idByEmail = new Map();
  static #passwordResetTokens = new Map();

  constructor({
    id = randomUUID(),
    name,
    email,
    passwordHash,
    role = "user",
    createdAt = new Date().toISOString()
  }) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.passwordHash = passwordHash;
    this.role = role;
    this.createdAt = createdAt;
    this.tokenVersion = 0;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role, //add admin role
      createdAt: this.createdAt
    };
  }

  static findByEmail(email) {
    const userId = this.#idByEmail.get(email);
    return userId ? this.#byId.get(userId) : undefined;
  }

  static findById(userId) {
    return this.#byId.get(userId);
  }

  static create({ name, email, passwordHash }) {
    if (this.#idByEmail.has(email)) {
      return null;
    }

    const user = new User({ name, email, passwordHash, role: "user" });
    this.#byId.set(user.id, user);
    this.#idByEmail.set(email, user.id);

    return user;
  }
  /*
  static createPasswordResetToken(userId, token, expiresAt) {
    const tokenHash = createHash("sha256").update(token).digest("hex");

    for (const [hash, record] of this.#passwordResetTokens) {
      if (record.userId === userId) {
        this.#passwordResetTokens.delete(hash);
      }
    }

    this.#passwordResetTokens.set(tokenHash, { userId, expiresAt });
    return tokenHash;
  }

  static deletePasswordResetToken(tokenHash) {
    this.#passwordResetTokens.delete(tokenHash);
  }

  static resetPassword(token, passwordHash, now = Date.now()) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const record = this.#passwordResetTokens.get(tokenHash);

    if (!record) {
      return false;
    }

    this.#passwordResetTokens.delete(tokenHash);
    if (Date.parse(record.expiresAt) <= now) {
      return false;
    }

    const user = this.#byId.get(record.userId);
    if (!user) {
      return false;
    }

    user.passwordHash = passwordHash;
    user.tokenVersion += 1;

    for (const [hash, otherRecord] of this.#passwordResetTokens) {
      if (otherRecord.userId === record.userId) {
        this.#passwordResetTokens.delete(hash);
      }
    }

    return true;
  } */
}
