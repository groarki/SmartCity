import { randomUUID } from "node:crypto";

export class Payment {
  static #records = new Map();
  static #idempotencyRecords = new Map();

  constructor({ reservationId, idempotencyKey, amount }) {
    this.id = randomUUID();
    this.reservationId = reservationId;
    this.idempotencyKey = idempotencyKey;
    this.amount = amount;
    this.currency = "PLN";
    this.status = "succeeded";
    this.createdAt = new Date().toISOString();
    this.simulated = true;
  }

  static findIdempotencyRecord(userId, idempotencyKey) {
    return this.#idempotencyRecords.get(`${userId}:${idempotencyKey}`);
  }

  static create(fields) {
    const payment = new Payment(fields);
    this.#records.set(payment.id, payment);
    return payment;
  }

  static saveIdempotentResult({
    userId,
    idempotencyKey,
    reservationId,
    payment,
    responseBody
  }) {
    this.#idempotencyRecords.set(`${userId}:${idempotencyKey}`, {
      reservationId,
      paymentId: payment.id,
      status: 200,
      responseBody
    });
  }
}
