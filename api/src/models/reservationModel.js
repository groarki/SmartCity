import { randomUUID } from "node:crypto";

const paymentHoldDurationMs = 10 * 60 * 1000;

export class Reservation {
  static #records = new Map();
  static #idempotencyRecords = new Map();

  constructor({
    id = randomUUID(),
    userId,
    parkingId,
    idempotencyKey,
    startTime,
    endTime,
    totalPrice,
    status = "pending_payment",
    expiresAt = new Date(Date.now() + paymentHoldDurationMs).toISOString(),
    holdExpiresAt = expiresAt,
    extensionOfReservationId = null,
    offlinePassToken,
    paymentId,
    spotHeld = true
  }) {
    this.id = id;
    this.userId = userId;
    this.parkingId = parkingId;
    this.idempotencyKey = idempotencyKey;
    this.startTime = new Date(startTime).toISOString();
    this.endTime = new Date(endTime).toISOString();
    this.expiresAt = expiresAt;
    this.holdExpiresAt = holdExpiresAt;
    this.status = status;
    this.totalPrice = totalPrice;
    this.extensionOfReservationId = extensionOfReservationId;
    this.offlinePassToken = offlinePassToken;
    this.paymentId = paymentId;
    this.spotHeld = spotHeld;
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      parkingId: this.parkingId,
      idempotencyKey: this.idempotencyKey,
      startTime: this.startTime,
      endTime: this.endTime,
      expiresAt: this.expiresAt,
      holdExpiresAt: this.holdExpiresAt,
      status: this.status,
      totalPrice: this.totalPrice,
      extensionOfReservationId: this.extensionOfReservationId,
      offlinePassToken: this.offlinePassToken,
      paymentId: this.paymentId,
      completedAt: this.completedAt
    };
  }

  confirm(paymentId, offlinePassToken) {
    if (this.status !== "pending_payment") {
      return false;
    }

    this.status = "confirmed";
    this.paymentId = paymentId;
    this.offlinePassToken = offlinePassToken;
    this.expiresAt = this.endTime;
    delete this.holdExpiresAt;
    return true;
  }

  updateSchedule({ startTime, endTime, totalPrice }) {
    if (this.status !== "pending_payment") {
      return false;
    }

    this.startTime = new Date(startTime).toISOString();
    this.endTime = new Date(endTime).toISOString();
    this.totalPrice = totalPrice;
    return true;
  }

  cancel() {
    if (this.status !== "pending_payment") {
      return false;
    }

    const releasedSpot = this.spotHeld;
    this.status = "cancelled";
    this.expiresAt = new Date().toISOString();
    delete this.holdExpiresAt;
    this.spotHeld = false;
    return releasedSpot;
  }

  markExtended(extendedByReservationId) {
    if (this.status !== "confirmed") {
      return false;
    }

    this.status = "extended";
    this.extendedByReservationId = extendedByReservationId;
    this.spotHeld = false;
    return true;
  }

  complete(completedAt = new Date().toISOString()) {
    if (this.status !== "confirmed") {
      return false;
    }

    this.status = "completed";
    this.completedAt = completedAt;
    this.expiresAt = completedAt;
    return true;
  }

  static create(fields, requestFingerprint) {
    const reservation = new Reservation(fields);
    this.#records.set(reservation.id, reservation);
    this.#idempotencyRecords.set(
      `${reservation.userId}:${reservation.idempotencyKey}`,
      { reservationId: reservation.id, requestFingerprint }
    );
    return reservation;
  }

  static findById(reservationId) {
    return this.#records.get(reservationId);
  }

  static findByIdempotencyKey(userId, idempotencyKey) {
    const record = this.#idempotencyRecords.get(`${userId}:${idempotencyKey}`);
    return record
      ? {
          ...record,
          reservation: this.findById(record.reservationId)
        }
      : undefined;
  }

  static listByUser(userId) {
    return [...this.#records.values()]
      .filter((reservation) => reservation.userId === userId)
      .sort((a, b) => b.startTime.localeCompare(a.startTime));
  }

  static confirm(reservationId, paymentId, offlinePassToken) {
    const reservation = this.findById(reservationId);
    return reservation?.confirm(paymentId, offlinePassToken)
      ? reservation
      : undefined;
  }

  static markExtended(reservationId, extendedByReservationId) {
    const reservation = this.findById(reservationId);
    return reservation?.markExtended(extendedByReservationId)
      ? reservation
      : undefined;
  }

  static complete(reservationId, completedAt) {
    const reservation = this.findById(reservationId);
    return reservation?.complete(completedAt) ? reservation : undefined;
  }

  static updateSchedule(reservationId, schedule) {
    const reservation = this.findById(reservationId);
    return reservation?.updateSchedule(schedule) ? reservation : undefined;
  }

  static cancel(reservationId) {
    const reservation = this.findById(reservationId);
    if (!reservation || reservation.status !== "pending_payment") {
      return undefined;
    }

    const releasedSpot = reservation.cancel();
    const idempotencyKey = `${reservation.userId}:${reservation.idempotencyKey}`;
    const idempotencyRecord = this.#idempotencyRecords.get(idempotencyKey);
    if (idempotencyRecord?.reservationId === reservation.id) {
      this.#idempotencyRecords.delete(idempotencyKey);
    }

    return { reservation, releasedSpot };
  }

  static expirePendingPaymentHolds(now = Date.now()) {
    const releasedParkingIds = [];

    for (const reservation of this.#records.values()) {
      if (
        reservation.status === "pending_payment" &&
        (Date.parse(reservation.holdExpiresAt) <= now ||
          Date.parse(reservation.endTime) <= now)
      ) {
        reservation.status = "expired";
        reservation.expiresAt =
          Date.parse(reservation.endTime) <= now
            ? reservation.endTime
            : reservation.holdExpiresAt;

        if (reservation.spotHeld) {
          reservation.spotHeld = false;
          releasedParkingIds.push(reservation.parkingId);
        }
      }
    }

    return releasedParkingIds;
  }

  static finishElapsedReservations(now = Date.now()) {
    const releasedParkingIds = [];

    for (const reservation of this.#records.values()) {
      if (
        reservation.status === "confirmed" &&
        Date.parse(reservation.endTime) <= now
      ) {
        reservation.complete(reservation.endTime);

        if (reservation.spotHeld) {
          reservation.spotHeld = false;
          releasedParkingIds.push(reservation.parkingId);
        }
      }
    }

    return releasedParkingIds;
  }
}
