# SmartCity API

A minimal Express REST API for local development. The current version uses
in-memory data; accounts, manually added test parkings, reservations, payments,
password-reset tokens, and idempotency records are cleared when the server
restarts.

## Models and storage

The API uses `User`, `Parking`, `Reservation`, and `Payment` model classes.
Each class owns its in-memory records and exposes operations such as lookup,
reservation completion, and spot availability updates. This is process-local
memory: reloading a mobile client does not clear it, but restarting the API
server does. No database is connected yet.

No parking records are seeded. Use `POST /api/parking` to add test parking
records; these receive server-generated UUIDs. In production, parking data is
expected to come from an external API. Prices are in PLN per hour.

## Password reset (not implemented yet)

The password-reset request and confirmation endpoints use one-time tokens
stored as hashes and expiring after 15 minutes. Configure `SMTP_HOST`,
`SMTP_PORT`, `SMTP_SECURE`, optional `SMTP_USER`/`SMTP_PASS`, `EMAIL_FROM`, and
`PASSWORD_RESET_URL` in `.env` to send reset links. Point
`PASSWORD_RESET_URL` to a frontend page that reads the `token` query parameter
and submits it to the confirmation endpoint. Requests fail with a
configuration error until those settings are valid; the API never returns a
reset token in its response. Completing a reset invalidates the user's
previous access tokens.

## Reservation and payment flow

1. Register with a name, email, and password, then authorize with the returned
   JWT.
2. Create a reservation using `POST /api/reservations` and an
   `Idempotency-Key`. The caller generates this key (typically a UUID); the API
   does not generate it. Send `durationMinutes` or `endTime` to choose the
   duration. If omitted, the API defaults to 60 minutes from now. The API holds
   one bookable spot for 10 minutes and returns the calculated total price.
3. Before payment, edit the schedule using `PATCH /api/reservations/:id` or
   cancel using `DELETE /api/reservations/:id`. Editing recalculates the price;
   cancelling releases the spot and makes the creation idempotency key
   available again.
4. Pay the displayed amount using `POST /api/reservations/:id/pay` with its own
   `Idempotency-Key`. A successful simulated payment confirms the reservation
   and returns an offline-pass JWT. Reusing the payment key returns the original
   payment result.
5. An extension creates a separate linked reservation beginning at the
   current reservation's end time. It uses a new idempotency key and payment,
   and does not decrement available spots a second time.
6. Complete a reservation with `POST /api/reservations/:id/complete` to release
   its spot early. Expired unpaid holds and elapsed reservations are also
   cleaned up during API requests.

## Run locally

Requires Node.js 20 or newer.

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Set `JWT_SECRET` in `.env` to a random secret of at least 32 characters. The
server listens at `http://localhost:3000` by default.
Run `npm test` to check the model tests.

## Interactive API testing

Open `http://localhost:3000/api-docs` to use Swagger UI. Select **Authorize**
and paste the access token returned by the register or login endpoint to try
protected operations. The OpenAPI document is available at
`http://localhost:3000/api-docs.json`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Register and receive an access token |
| POST | `/api/auth/login` | Sign in and receive an access token |
| POST | `/api/auth/password-reset/request` | Email a one-time password-reset link |
| POST | `/api/auth/password-reset/confirm` | Set a new password with a reset token |
| GET | `/api/parking` | List parking; supports `lat`, `lng`, and `radiusKm` |
| POST | `/api/parking` | Add a test parking with a generated UUID |
| GET | `/api/parking/:parkingId` | Get a parking record |
| POST | `/api/reservations` | Create a 10-minute unpaid reservation hold |
| GET | `/api/reservations/me` | List the signed-in user's reservations |
| PATCH | `/api/reservations/:reservationId` | Edit an unpaid reservation |
| DELETE | `/api/reservations/:reservationId` | Cancel an unpaid reservation |
| POST | `/api/reservations/:reservationId/pay` | Simulate payment and confirm a reservation |
| POST | `/api/reservations/:reservationId/extensions` | Create a linked extension hold |
| POST | `/api/reservations/:reservationId/complete` | Complete a reservation and release its spot |

Protected routes require `Authorization: Bearer <token>`. Reservation creation,
extensions, and payment require an `Idempotency-Key` header. Retry each
operation with the same key and same request to avoid duplicate reservations
or payments.

The in-memory implementation is a local starting point, not persistent or
multi-instance storage. Idempotency across restarts or server instances will
require a shared database when that part of the project is added.
