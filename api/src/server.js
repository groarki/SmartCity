import express from "express";
import swaggerUi from "swagger-ui-express";
import { config } from "./config.js";
import { openApiSpec } from "./swagger/openapi.js";
import { errorHandler } from "./middleware/errorHandler.js";
import apiRouter from "./routing/routes.js";
import { HttpError } from "./utils/httpError.js";

const app = express();

app.use(express.json());
app.get("/api-docs.json", (req, res) => {
  res.json(openApiSpec);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.use("/api", apiRouter);

app.use((req, res, next) => {
  next(new HttpError(404, "Route not found."));
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`SmartCity API listening at http://localhost:${config.port}`);
});
