import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { Parking } from "../models/parkingModel.js";
import { Payment } from "../models/paymentModel.js";
import { Reservation } from "../models/reservationModel.js";
import { sweepReservations } from "../services/reservationMaintenance.js";
import { HttpError } from "../utils/httpError.js";

const paymentHoldDurationMs = 10 * 60 * 1000;
const minimumDurationMinutes = 15;
const maximumDurationMinutes = 720;

function requireIdempotencyKey(req) {
  const key = req.get("Idempotency-Key");

  if (!key || key.length > 128) {
    throw new HttpError(
      400,
      "Provide an Idempotency-Key header (up to 128 characters)."
    );
  }

  return key;
}

function parseDateTime(value, fieldName) {
  const date = new Date(value);

  if (typeof value !== "string" || !Number.isFinite(date.getTime())) {
    throw new HttpError(400, `${fieldName} must be a valid date-time.`);
  }

  return date;
}

function getSchedule(body, forcedStartTime, existingSchedule) {
  const startTime = forcedStartTime
    ? new Date(forcedStartTime)
    : body?.startTime === undefined
      ? existingSchedule
        ? new Date(existingSchedule.startTime)
        : new Date()
      : parseDateTime(body.startTime, "startTime");

  let endTime;
  if (body?.endTime !== undefined) {
    endTime = parseDateTime(body.endTime, "endTime");
  } else {
    const defaultDuration = existingSchedule
      ? (Date.parse(existingSchedule.endTime) -
          Date.parse(existingSchedule.startTime)) /
        60_000
      : 60;
    const durationMinutes = Number(body?.durationMinutes ?? defaultDuration);
    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < minimumDurationMinutes ||
      durationMinutes > maximumDurationMinutes
    ) {
      throw new HttpError(
        400,
        `durationMinutes must be between ${minimumDurationMinutes} and ${maximumDurationMinutes}.`
      );
    }

    endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  }

  const durationMinutes = (endTime.getTime() - startTime.getTime()) / 60_000;
  if (
    !Number.isFinite(durationMinutes) ||
    durationMinutes < minimumDurationMinutes ||
    durationMinutes > maximumDurationMinutes
  ) {
    throw new HttpError(
      400,
      `The reservation duration must be between ${minimumDurationMinutes} and ${maximumDurationMinutes} minutes.`
    );
  }
  if (endTime.getTime() <= Date.now()) {
    throw new HttpError(400, "endTime must be in the future.");
  }

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    durationMinutes
  };
}

function getTotalPrice(parking, durationMinutes) {
  return Number(((parking.pricePerHour * durationMinutes) / 60).toFixed(2));
}

function getRequestFingerprint(parkingId, body, extensionOfReservationId) {
  const intent = {
    parkingId,
    startTime: body?.startTime ?? null,
    endTime: body?.endTime ?? null,
    durationMinutes:
      body?.endTime === undefined ? Number(body?.durationMinutes ?? 60) : null,
    extensionOfReservationId
  };

  if (extensionOfReservationId) {
    intent.startTime = null;
  }

  return JSON.stringify(intent);
}

function replayReservation(req, res, key, fingerprint) {
  const previous = Reservation.findByIdempotencyKey(req.user.sub, key);
  if (!previous) {
    return false;
  }

  if (previous.requestFingerprint !== fingerprint) {
    throw new HttpError(
      409,
      "This Idempotency-Key was already used with different reservation details."
    );
  }

  res.status(200).json({ data: previous.reservation });
  return true;
}

function createOfflinePass(reservation, userId) {
  const now = Date.now();
  const startSeconds = Math.max(
    0,
    Math.ceil((Date.parse(reservation.startTime) - now) / 1000)
  );
  const expirySeconds = Math.ceil(
    (Date.parse(reservation.endTime) - now) / 1000
  );

  return jwt.sign(
    {
      type: "offline-parking-pass",
      reservationId: reservation.id,
      parkingId: reservation.parkingId
    },
    config.jwtSecret,
    {
      subject: userId,
      notBefore: startSeconds,
      expiresIn: expirySeconds
    }
  );
}

export function create(req, res) {
  sweepReservations();

  const idempotencyKey = requireIdempotencyKey(req);
  const parkingId = req.body?.parkingId;
  if (typeof parkingId !== "string" || !parkingId) {
    throw new HttpError(400, "parkingId is required.");
  }

  const fingerprint = getRequestFingerprint(parkingId, req.body);
  if (replayReservation(req, res, idempotencyKey, fingerprint)) {
    return;
  }

  const parking = Parking.findById(parkingId);
  if (!parking) {
    throw new HttpError(404, "Parking not found.");
  }
  if (!parking.isBookable) {
    throw new HttpError(409, "This parking is not bookable in this system.");
  }

  const schedule = getSchedule(req.body);

  if (parking.availableSpots < 1) {
    throw new HttpError(409, "No parking spots are currently available.");
  }

  if (!Parking.reserveSpot(parkingId)) {
    throw new HttpError(409, "No parking spots are currently available.");
  }

  const holdExpiresAt = new Date(Date.now() + paymentHoldDurationMs).toISOString();
  const reservation = Reservation.create(
    {
      userId: req.user.sub,
      parkingId,
      idempotencyKey,
      ...schedule,
      totalPrice: getTotalPrice(parking, schedule.durationMinutes),
      status: "pending_payment",
      expiresAt: holdExpiresAt,
      holdExpiresAt
    },
    fingerprint
  );

  res.status(201).json({ data: reservation });
}

export function createExtension(req, res) {
  sweepReservations();

  const idempotencyKey = requireIdempotencyKey(req);
  const previousReservation = Reservation.findById(req.params.reservationId);
  if (!previousReservation || previousReservation.userId !== req.user.sub) {
    throw new HttpError(404, "Reservation not found.");
  }

  const fingerprint = getRequestFingerprint(
    previousReservation.parkingId,
    req.body,
    previousReservation.id
  );
  if (replayReservation(req, res, idempotencyKey, fingerprint)) {
    return;
  }

  if (
    previousReservation.status !== "confirmed" ||
    Date.now() >= Date.parse(previousReservation.endTime)
  ) {
    throw new HttpError(409, "Only a current confirmed reservation can be extended.");
  }

  const parking = Parking.findById(previousReservation.parkingId);
  if (!parking?.isBookable) {
    throw new HttpError(409, "This parking is not bookable in this system.");
  }

  const schedule = getSchedule(req.body, previousReservation.endTime);

  const holdExpiresAt = new Date(Date.now() + paymentHoldDurationMs).toISOString();
  const extension = Reservation.create(
    {
      userId: req.user.sub,
      parkingId: previousReservation.parkingId,
      idempotencyKey,
      ...schedule,
      totalPrice: getTotalPrice(parking, schedule.durationMinutes),
      status: "pending_payment",
      expiresAt: holdExpiresAt,
      holdExpiresAt,
      extensionOfReservationId: previousReservation.id,
      spotHeld: false
    },
    fingerprint
  );

  res.status(201).json({ data: extension });
}

export function getMine(req, res) {
  sweepReservations();
  res.json({ data: Reservation.listByUser(req.user.sub) });
}

export function edit(req, res) {
  sweepReservations();

  const reservation = Reservation.findById(req.params.reservationId);
  if (!reservation || reservation.userId !== req.user.sub) {
    throw new HttpError(404, "Reservation not found.");
  }
  if (reservation.status !== "pending_payment") {
    throw new HttpError(409, "Only an unpaid reservation can be edited.");
  }
  if (
    req.body?.startTime === undefined &&
    req.body?.endTime === undefined &&
    req.body?.durationMinutes === undefined
  ) {
    throw new HttpError(400, "Provide startTime, endTime, or durationMinutes.");
  }

  const parking = Parking.findById(reservation.parkingId);
  if (!parking?.isBookable) {
    throw new HttpError(409, "This parking is not bookable in this system.");
  }

  const schedule = getSchedule(req.body, undefined, reservation);
  const updatedReservation = Reservation.updateSchedule(reservation.id, {
    ...schedule,
    totalPrice: getTotalPrice(parking, schedule.durationMinutes)
  });

  res.json({ data: updatedReservation });
}

export function cancel(req, res) {
  sweepReservations();

  const reservation = Reservation.findById(req.params.reservationId);
  if (!reservation || reservation.userId !== req.user.sub) {
    throw new HttpError(404, "Reservation not found.");
  }

  const result = Reservation.cancel(reservation.id);
  if (!result) {
    throw new HttpError(409, "Only an unpaid reservation can be cancelled.");
  }
  if (result.releasedSpot) {
    Parking.releaseSpot(result.reservation.parkingId);
  }

  res.json({ data: result.reservation });
}

export function pay(req, res) {
  sweepReservations();

  const idempotencyKey = requireIdempotencyKey(req);
  const previousPayment = Payment.findIdempotencyRecord(
    req.user.sub,
    idempotencyKey
  );

  if (previousPayment) {
    if (previousPayment.reservationId !== req.params.reservationId) {
      throw new HttpError(
        409,
        "This Idempotency-Key was already used for another reservation."
      );
    }

    return res.status(previousPayment.status).json(previousPayment.responseBody);
  }

  const reservation = Reservation.findById(req.params.reservationId);
  if (!reservation || reservation.userId !== req.user.sub) {
    throw new HttpError(404, "Reservation not found.");
  }
  if (reservation.status !== "pending_payment") {
    throw new HttpError(409, "This reservation is not awaiting payment.");
  }

  let parentReservation;
  if (reservation.extensionOfReservationId) {
    parentReservation = Reservation.findById(
      reservation.extensionOfReservationId
    );
    if (
      !parentReservation ||
      parentReservation.status !== "confirmed" ||
      Date.now() >= Date.parse(parentReservation.endTime)
    ) {
      throw new HttpError(409, "The original reservation can no longer be extended.");
    }
  }

  const payment = Payment.create({
    reservationId: reservation.id,
    idempotencyKey,
    amount: reservation.totalPrice
  });
  const offlinePassToken = createOfflinePass(reservation, req.user.sub);
  const confirmedReservation = Reservation.confirm(
    reservation.id,
    payment.id,
    offlinePassToken
  );

  if (parentReservation) {
    Reservation.markExtended(parentReservation.id, reservation.id);
    confirmedReservation.spotHeld = true;
  }

  const responseBody = {
    data: {
      payment,
      reservation: confirmedReservation
    }
  };
  Payment.saveIdempotentResult({
    userId: req.user.sub,
    idempotencyKey,
    reservationId: reservation.id,
    payment,
    responseBody
  });

  res.json(responseBody);
}

export function complete(req, res) {
  sweepReservations();

  const reservation = Reservation.findById(req.params.reservationId);
  if (!reservation || reservation.userId !== req.user.sub) {
    throw new HttpError(404, "Reservation not found.");
  }
  if (reservation.status === "completed") {
    return res.json({ data: reservation });
  }

  const completedReservation = Reservation.complete(reservation.id);
  if (!completedReservation) {
    throw new HttpError(409, "Only a confirmed reservation can be completed.");
  }

  if (completedReservation.spotHeld) {
    completedReservation.spotHeld = false;
    Parking.releaseSpot(completedReservation.parkingId);
  }

  res.json({ data: completedReservation });
}
