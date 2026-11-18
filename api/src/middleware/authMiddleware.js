import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User } from "../models/userModel.js";
import { HttpError } from "../utils/httpError.js";

export function requireAuth(req, res, next) {
  const authorization = req.get("Authorization");
  const parts = authorization?.split(" ");

  if (parts?.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    return next(new HttpError(401, "A Bearer token is required."));
  }

  try {
    const payload = jwt.verify(parts[1], config.jwtSecret);
    const user = User.findById(payload.sub);
    if (!user || payload.tokenVersion !== user.tokenVersion) {
      return next(new HttpError(401, "The access token is invalid or expired."));
    }

    req.user = payload;
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      return next(new HttpError(401, "The access token is invalid or expired."));
    }

    return next(error);
  }
}
