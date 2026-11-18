import { Parking } from "../models/parkingModel.js";
import { sweepReservations } from "../services/reservationMaintenance.js";
import { HttpError } from "../utils/httpError.js";

function parseCoordinate(value) {
  if (value === undefined) {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function distanceInKm(lat1, lon1, lat2, lon2) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(lat2 - lat1);
  const longitudeDelta = radians(lon2 - lon1);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getParkings(req, res) {
  sweepReservations();

  const latitude = parseCoordinate(req.query.lat);
  const longitude = parseCoordinate(req.query.lng);
  const radiusKm = parseCoordinate(req.query.radiusKm);

  if (latitude === null || longitude === null || radiusKm === null) {
    throw new HttpError(400, "Location and radius parameters must be numbers.");
  }

  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new HttpError(400, "Provide both lat and lng to search by location.");
  }

  if (radiusKm !== undefined && latitude === undefined) {
    throw new HttpError(400, "Provide lat and lng when using radiusKm.");
  }

  if (
    latitude !== undefined &&
    (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
  ) {
    throw new HttpError(400, "The provided coordinates are out of range.");
  }

  if (radiusKm !== undefined && radiusKm <= 0) {
    throw new HttpError(400, "radiusKm must be greater than zero.");
  }

  let parkings = Parking.list().map((parking) => ({ ...parking }));

  if (latitude !== undefined) {
    const radius = radiusKm ?? 5;
    parkings = parkings
      .map((parking) => ({
        ...parking,
        distanceKm: Number(
          distanceInKm(
            latitude,
            longitude,
            parking.latitude,
            parking.longitude
          ).toFixed(2)
        )
      }))
      .filter((parking) => parking.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  res.json({ data: parkings });
}

export function createParking(req, res) {
  const {
    name,
    address,
    source = "manual",
    latitude,
    longitude,
    totalSpots,
    availableSpots = totalSpots,
    pricePerHour,
    isBookable = false
  } = req.body ?? {};

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof address !== "string" ||
    !address.trim() ||
    typeof source !== "string" ||
    !source.trim()
  ) {
    throw new HttpError(400, "name, address, and source must be non-empty strings.");
  }

  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new HttpError(400, "Valid numeric latitude and longitude are required.");
  }

  if (
    !Number.isInteger(totalSpots) ||
    totalSpots < 1 ||
    !Number.isInteger(availableSpots) ||
    availableSpots < 0 ||
    availableSpots > totalSpots
  ) {
    throw new HttpError(
      400,
      "totalSpots must be positive and availableSpots must be between zero and totalSpots."
    );
  }

  if (
    typeof pricePerHour !== "number" ||
    !Number.isFinite(pricePerHour) ||
    pricePerHour < 0
  ) {
    throw new HttpError(400, "pricePerHour must be a non-negative number.");
  }

  if (typeof isBookable !== "boolean") {
    throw new HttpError(400, "isBookable must be a boolean.");
  }

  const parking = Parking.create({
    source: source.trim(),
    name: name.trim(),
    address: address.trim(),
    latitude,
    longitude,
    totalSpots,
    availableSpots,
    pricePerHour,
    isBookable
  });

  res.status(201).json({ data: parking });
}

export function getParking(req, res) {
  sweepReservations();

  const parking = Parking.findById(req.params.parkingId);

  if (!parking) {
    throw new HttpError(404, "Parking not found.");
  }

  res.json({ data: parking });
}
