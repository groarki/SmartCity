export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = Number.isInteger(error.status) ? error.status : 500;

  if (status === 500) {
    console.error(error);
  }

  res.status(status).json({
    error: {
      message: status === 500 ? "Internal server error." : error.message
    }
  });
}
