import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Parking } from "../src/models/parkingModel.js";
import { Reservation } from "../src/models/reservationModel.js";
import { User } from "../src/models/userModel.js";

test("parking records receive UUID identifiers", () => {
  const parking = Parking.create({
    source: "manual",
    name: "Test parking",
    address: "Test address",
    latitude: 52,
    longitude: 21,
    totalSpots: 2,
    pricePerHour: 5
  });

  assert.match(
    parking.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  );
  assert.equal(Parking.findById(parking.id), parking);
});

test("cancelling releases the creation key for reuse", () => {
  const userId = randomUUID();
  const parkingId = randomUUID();
  const idempotencyKey = randomUUID();
  const first = Reservation.create(
    {
      userId,
      parkingId,
      idempotencyKey,
      startTime: new Date(Date.now() + 60_000).toISOString(),
      endTime: new Date(Date.now() + 3_660_000).toISOString(),
      totalPrice: 5
    },
    "request-fingerprint"
  );

  assert.equal(
    Reservation.updateSchedule(first.id, {
      startTime: first.startTime,
      endTime: new Date(Date.parse(first.startTime) + 90 * 60_000).toISOString(),
      totalPrice: 7.5
    }).totalPrice,
    7.5
  );

  const cancelled = Reservation.cancel(first.id);
  assert.equal(cancelled.reservation.status, "cancelled");
  assert.equal(cancelled.releasedSpot, true);
  assert.equal(Reservation.findByIdempotencyKey(userId, idempotencyKey), undefined);

  const replacement = Reservation.create(
    {
      userId,
      parkingId,
      idempotencyKey,
      startTime: new Date(Date.now() + 60_000).toISOString(),
      endTime: new Date(Date.now() + 3_660_000).toISOString(),
      totalPrice: 5
    },
    "request-fingerprint"
  );
  assert.notEqual(replacement.id, first.id);
  assert.equal(
    Reservation.findByIdempotencyKey(userId, idempotencyKey).reservation,
    replacement
  );
});

test("confirmed reservations cannot be edited or cancelled", () => {
  const reservation = Reservation.create(
    {
      userId: randomUUID(),
      parkingId: randomUUID(),
      idempotencyKey: randomUUID(),
      startTime: new Date(Date.now() + 60_000).toISOString(),
      endTime: new Date(Date.now() + 3_660_000).toISOString(),
      totalPrice: 5
    },
    "request-fingerprint"
  );
  Reservation.confirm(reservation.id, randomUUID(), "offline-pass");

  assert.equal(
    Reservation.updateSchedule(reservation.id, {
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      totalPrice: reservation.totalPrice
    }),
    undefined
  );
  assert.equal(Reservation.cancel(reservation.id), undefined);
});

/*test("password reset tokens expire and are single-use", () => {
  const user = User.create({
    name: "Reset test",
    email: `${randomUUID()}@example.com`,
    passwordHash: "old-hash"
  });
  User.createPasswordResetToken(
    user.id,
    "expired-token",
    new Date(0).toISOString()
  );
  assert.equal(User.resetPassword("expired-token", "expired-hash"), false);

  User.createPasswordResetToken(
    user.id,
    "valid-token",
    new Date(Date.now() + 60_000).toISOString()
  );
  assert.equal(User.resetPassword("valid-token", "new-hash"), true);
  assert.equal(user.passwordHash, "new-hash");
  assert.equal(user.tokenVersion, 1);
  assert.equal(User.resetPassword("valid-token", "reused-hash"), false);
}); */
