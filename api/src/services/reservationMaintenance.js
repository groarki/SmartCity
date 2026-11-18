import { Parking } from "../models/parkingModel.js";
import { Reservation } from "../models/reservationModel.js";

export function sweepReservations() {
  const releasedParkingIds = [
    ...Reservation.expirePendingPaymentHolds(),
    ...Reservation.finishElapsedReservations()
  ];

  for (const parkingId of releasedParkingIds) {
    Parking.releaseSpot(parkingId);
  }
}
