const errorResponse = {
  description: "Request failed.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" }
    }
  }
};

const authSecurity = [{ bearerAuth: [] }];

const idempotencyHeader = {
  name: "Idempotency-Key",
  in: "header",
  required: true,
  description: "Reuse this key when retrying the same operation.",
  schema: { type: "string", maxLength: 128, example: "operation-uuid" }
};

const reservationResponse = {
  type: "object",
  properties: {
    data: { $ref: "#/components/schemas/Reservation" }
  },
  required: ["data"]
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "SmartCity Parking API",
    version: "1.0.0",
    description:
      "Local starter API for parking search, temporary reservation holds, simulated payments, and reservation extensions. Data is in memory and resets when the API server restarts."
  },
  servers: [{ url: "/api", description: "This server" }],
  tags: [
    { name: "Health" },
    { name: "Authentication" },
    { name: "Parking" },
    { name: "Reservations" }
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Check API health",
        responses: {
          200: {
            description: "The API is running.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: { status: { type: "string", example: "ok" } },
                      required: ["status"]
                    }
                  },
                  required: ["data"]
                }
              }
            }
          }
        }
      }
    },
    "/auth/register": {
      post: {
        tags: ["Authentication"],
        summary: "Register a user",
        description:
          "Public registration always creates a user role. Admin roles must be assigned through a trusted administrative process.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterRequest" },
              example: {
                name: "Alex Driver",
                email: "driver@example.com",
                password: "example-password"
              }
            }
          }
        },
        responses: {
          201: {
            description: "Account created and access token returned.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" }
              }
            }
          },
          400: errorResponse,
          409: errorResponse
        }
      }
    },
    "/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Log in",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Credentials" },
              example: {
                email: "driver@example.com",
                password: "example-password"
              }
            }
          }
        },
        responses: {
          200: {
            description: "Authenticated successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" }
              }
            }
          },
          400: errorResponse,
          401: errorResponse
        }
      }
    },
    /*
    "/auth/password-reset/request": {
      post: {
        tags: ["Authentication"],
        summary: "Request a password reset email",
        description:
          "Sends a single-use reset link that expires after 15 minutes. Email delivery must be configured. The response does not reveal whether the email belongs to an account.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PasswordResetRequest" }
            }
          }
        },
        responses: {
          202: {
            description: "Reset instructions were sent if the account exists.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" }
              }
            }
          },
          400: errorResponse,
          503: errorResponse,
          500: errorResponse
        }
      }
    },
    "/auth/password-reset/confirm": {
      post: {
        tags: ["Authentication"],
        summary: "Set a new password with a reset token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PasswordResetConfirmRequest" }
            }
          }
        },
        responses: {
          200: {
            description: "Password reset successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" }
              }
            }
          },
          400: errorResponse
        }
      }
    }, */
    "/parking": {
      get: {
        tags: ["Parking"],
        summary: "List parking facilities",
        description:
          "Optionally provide lat and lng together to return nearby parking sorted by distance. radiusKm defaults to 5 when coordinates are provided.",
        parameters: [
          {
            name: "lat",
            in: "query",
            description: "Latitude (-90 to 90); provide together with lng.",
            schema: { type: "number", minimum: -90, maximum: 90, example: 52.2297 }
          },
          {
            name: "lng",
            in: "query",
            description: "Longitude (-180 to 180); provide together with lat.",
            schema: { type: "number", minimum: -180, maximum: 180, example: 21.0122 }
          },
          {
            name: "radiusKm",
            in: "query",
            description: "Search radius in kilometers; requires lat and lng.",
            schema: {
              type: "number",
              minimum: 0,
              exclusiveMinimum: true,
              example: 5
            }
          }
        ],
        responses: {
          200: {
            description: "Parking facilities, optionally including distanceKm.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Parking" }
                    }
                  },
                  required: ["data"]
                }
              }
            }
          },
          400: errorResponse
        }
      },
      post: {
        tags: ["Parking"],
        summary: "Add a test parking facility",
        description:
          "Creates an in-memory parking record with a server-generated UUID. Intended for local testing; production parking data should come from an external source.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateParkingRequest" },
              example: {
                source: "manual",
                name: "Test Parking",
                address: "Example Street 1",
                latitude: 52.2297,
                longitude: 21.0122,
                totalSpots: 40,
                availableSpots: 12,
                pricePerHour: 5,
                isBookable: true
              }
            }
          }
        },
        responses: {
          201: {
            description: "Test parking created with a UUID.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/Parking" } },
                  required: ["data"]
                }
              }
            }
          },
          400: errorResponse
        }
      }
    },
    "/parking/{parkingId}": {
      get: {
        tags: ["Parking"],
        summary: "Get a parking facility",
        parameters: [
          {
            name: "parkingId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        responses: {
          200: {
            description: "Parking facility details.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/Parking" } },
                  required: ["data"]
                }
              }
            }
          },
          404: errorResponse
        }
      }
    },
    "/reservations": {
      post: {
        tags: ["Reservations"],
        summary: "Create a temporary reservation hold",
        description:
          "The server temporarily holds an available spot for 10 minutes while payment is completed. Retry creation with the same Idempotency-Key and identical request to avoid duplicate holds.",
        security: authSecurity,
        parameters: [idempotencyHeader],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateReservationRequest" },
              example: {
                parkingId: "00000000-0000-4000-8000-000000000001",
                durationMinutes: 60
              }
            }
          }
        },
        responses: {
          201: {
            description: "A pending-payment hold was created.",
            content: {
              "application/json": { schema: reservationResponse }
            }
          },
          400: errorResponse,
          401: errorResponse,
          404: errorResponse,
          409: errorResponse
        }
      }
    },
    "/reservations/{reservationId}": {
      patch: {
        tags: ["Reservations"],
        summary: "Edit an unpaid reservation",
        description:
          "Updates the schedule and recalculates the total price. Only pending-payment reservations can be edited. Omitted schedule values keep their current values.",
        security: authSecurity,
        parameters: [
          {
            name: "reservationId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateReservationRequest" },
              example: { durationMinutes: 90 }
            }
          }
        },
        responses: {
          200: {
            description: "Reservation schedule updated.",
            content: {
              "application/json": { schema: reservationResponse }
            }
          },
          400: errorResponse,
          401: errorResponse,
          404: errorResponse,
          409: errorResponse
        }
      },
      delete: {
        tags: ["Reservations"],
        summary: "Cancel an unpaid reservation",
        description:
          "Only pending-payment reservations can be cancelled. The held spot is released and the reservation-creation idempotency key becomes available for reuse.",
        security: authSecurity,
        parameters: [
          {
            name: "reservationId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        responses: {
          200: {
            description: "Reservation cancelled and any held spot released.",
            content: {
              "application/json": { schema: reservationResponse }
            }
          },
          401: errorResponse,
          404: errorResponse,
          409: errorResponse
        }
      }
    },
    "/reservations/me": {
      get: {
        tags: ["Reservations"],
        summary: "List the authenticated user's reservations",
        security: authSecurity,
        responses: {
          200: {
            description: "Reservations belonging to the authenticated user.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Reservation" }
                    }
                  },
                  required: ["data"]
                }
              }
            }
          },
          401: errorResponse
        }
      }
    },
    "/reservations/{reservationId}/extensions": {
      post: {
        tags: ["Reservations"],
        summary: "Create a linked reservation to extend a booking",
        description:
          "Creates a separate reservation starting exactly when the original ends. It does not consume another spot. Payment must be completed before the original reservation ends.",
        security: authSecurity,
        parameters: [
          {
            name: "reservationId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          },
          idempotencyHeader
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ExtensionRequest" },
              example: { durationMinutes: 60 }
            }
          }
        },
        responses: {
          201: {
            description: "A linked extension hold was created.",
            content: {
              "application/json": { schema: reservationResponse }
            }
          },
          400: errorResponse,
          401: errorResponse,
          404: errorResponse,
          409: errorResponse
        }
      }
    },
    "/reservations/{reservationId}/pay": {
      post: {
        tags: ["Reservations"],
        summary: "Pay for a pending reservation hold",
        description:
          "Simulates payment, confirms the reservation, and returns an offline-pass JWT. Retry with the same Idempotency-Key to receive the original result.",
        security: authSecurity,
        parameters: [
          {
            name: "reservationId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          },
          idempotencyHeader
        ],
        responses: {
          200: {
            description: "Payment succeeded and the reservation was confirmed.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PaymentResponse" }
              }
            }
          },
          400: errorResponse,
          401: errorResponse,
          404: errorResponse,
          409: errorResponse
        }
      }
    },
    "/reservations/{reservationId}/complete": {
      post: {
        tags: ["Reservations"],
        summary: "Complete a confirmed reservation and release its spot",
        security: authSecurity,
        parameters: [
          {
            name: "reservationId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        responses: {
          200: {
            description: "Reservation completed and spot released.",
            content: {
              "application/json": { schema: reservationResponse }
            }
          },
          401: errorResponse,
          404: errorResponse,
          409: errorResponse
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Use the access token returned by register or login."
      }
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"]
          }
        },
        required: ["error"]
      },
      Credentials: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8, maxLength: 72 }
        },
        required: ["email", "password"]
      },
      RegisterRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8, maxLength: 72 }
        },
        required: ["name", "email", "password"]
      },
      PasswordResetRequest: {
        type: "object",
        properties: { email: { type: "string", format: "email" } },
        required: ["email"]
      },
      PasswordResetConfirmRequest: {
        type: "object",
        properties: {
          token: { type: "string" },
          newPassword: { type: "string", minLength: 8, maxLength: 72 }
        },
        required: ["token", "newPassword"]
      },
      MessageResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"]
          }
        },
        required: ["data"]
      },
      AuthResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              user: { $ref: "#/components/schemas/User" },
              token: { type: "string" }
            },
            required: ["user", "token"]
          }
        },
        required: ["data"]
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["user", "admin"] },
          createdAt: { type: "string", format: "date-time" }
        },
        required: ["id", "name", "email", "role", "createdAt"]
      },
      Parking: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          source: { type: "string", example: "manual" },
          name: { type: "string" },
          address: { type: "string" },
          latitude: { type: "number" },
          longitude: { type: "number" },
          totalSpots: { type: "integer" },
          availableSpots: { type: "integer" },
          pricePerHour: { type: "number", description: "Price in PLN per hour." },
          isBookable: { type: "boolean" },
          lastSyncedAt: { type: "string", format: "date-time", nullable: true },
          distanceKm: {
            type: "number",
            description: "Included only for location-based searches."
          }
        },
        required: [
          "id",
          "source",
          "name",
          "address",
          "latitude",
          "longitude",
          "totalSpots",
          "availableSpots",
          "pricePerHour",
          "isBookable",
          "lastSyncedAt"
        ]
      },
      CreateParkingRequest: {
        type: "object",
        properties: {
          source: { type: "string", default: "manual" },
          name: { type: "string", minLength: 1 },
          address: { type: "string", minLength: 1 },
          latitude: { type: "number", minimum: -90, maximum: 90 },
          longitude: { type: "number", minimum: -180, maximum: 180 },
          totalSpots: { type: "integer", minimum: 1 },
          availableSpots: { type: "integer", minimum: 0 },
          pricePerHour: { type: "number", minimum: 0 },
          isBookable: { type: "boolean", default: false }
        },
        required: [
          "name",
          "address",
          "latitude",
          "longitude",
          "totalSpots",
          "pricePerHour"
        ]
      },
      CreateReservationRequest: {
        type: "object",
        properties: {
          parkingId: { type: "string", format: "uuid" },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time" },
          durationMinutes: {
            type: "integer",
            minimum: 15,
            maximum: 720,
            default: 60
          }
        },
        required: ["parkingId"],
        description:
          "Provide endTime, or provide durationMinutes. startTime defaults to now."
      },
      UpdateReservationRequest: {
        type: "object",
        properties: {
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time" },
          durationMinutes: {
            type: "integer",
            minimum: 15,
            maximum: 720
          }
        },
        minProperties: 1,
        description:
          "Provide at least one schedule field. If startTime or durationMinutes is omitted, its current value is retained."
      },
      ExtensionRequest: {
        type: "object",
        properties: {
          endTime: { type: "string", format: "date-time" },
          durationMinutes: {
            type: "integer",
            minimum: 15,
            maximum: 720,
            default: 60
          }
        },
        description:
          "Provide endTime, or provide durationMinutes. The extension begins at the original reservation's endTime."
      },
      Reservation: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          parkingId: { type: "string", format: "uuid" },
          idempotencyKey: { type: "string" },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time" },
          expiresAt: { type: "string", format: "date-time" },
          holdExpiresAt: { type: "string", format: "date-time", nullable: true },
          status: {
            type: "string",
            enum: [
              "pending_payment",
              "confirmed",
              "extended",
              "completed",
              "expired",
              "cancelled"
            ]
          },
          totalPrice: { type: "number", description: "Price in PLN." },
          extensionOfReservationId: {
            type: "string",
            format: "uuid",
            nullable: true
          },
          offlinePassToken: { type: "string" },
          paymentId: { type: "string", format: "uuid" },
          completedAt: { type: "string", format: "date-time" }
        },
        required: [
          "id",
          "userId",
          "parkingId",
          "idempotencyKey",
          "startTime",
          "endTime",
          "expiresAt",
          "status",
          "totalPrice"
        ]
      },
      Payment: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          reservationId: { type: "string", format: "uuid" },
          idempotencyKey: { type: "string" },
          amount: { type: "number", description: "Amount in PLN." },
          currency: { type: "string", example: "PLN" },
          status: { type: "string", example: "succeeded" },
          createdAt: { type: "string", format: "date-time" },
          simulated: { type: "boolean", example: true }
        },
        required: [
          "id",
          "reservationId",
          "idempotencyKey",
          "amount",
          "status",
          "createdAt"
        ]
      },
      PaymentResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              payment: { $ref: "#/components/schemas/Payment" },
              reservation: { $ref: "#/components/schemas/Reservation" }
            },
            required: ["payment", "reservation"]
          }
        },
        required: ["data"]
      }
    }
  }
};
