import { randomUUID } from "node:crypto";

export class Parking {
  static #records = new Map();

  constructor({
    id,
    source,
    name,
    address,
    latitude,
    longitude,
    totalSpots,
    availableSpots = totalSpots,
    pricePerHour,
    isBookable = false,
    lastSyncedAt = null
  }) {
    this.id = id;
    this.source = source;
    this.name = name;
    this.address = address;
    this.latitude = latitude;
    this.longitude = longitude;
    this.totalSpots = totalSpots;
    this.availableSpots = availableSpots;
    this.pricePerHour = pricePerHour;
    this.isBookable = isBookable;
    this.lastSyncedAt = lastSyncedAt;
  }

  reserveSpot() {
    if (!this.isBookable || this.availableSpots < 1) {
      return false;
    }

    this.availableSpots -= 1;
    return true;
  }

  releaseSpot() {
    this.availableSpots = Math.min(this.totalSpots, this.availableSpots + 1);
  }

  static list() {
    return [...this.#records.values()];
  }

  static findById(parkingId) {
    return this.#records.get(parkingId);
  }

  static create(fields) {
    const parking = new Parking({ ...fields, id: randomUUID() });
    this.#records.set(parking.id, parking);
    return parking;
  }

  static reserveSpot(parkingId) {
    return this.findById(parkingId)?.reserveSpot() ?? false;
  }

  static releaseSpot(parkingId) {
    this.findById(parkingId)?.releaseSpot();
  }
}
