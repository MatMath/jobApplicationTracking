// This is to have generic error handling for later.

const routeNotFound = (req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
};

const genericErrorHandling = (err, req, res, next) => {
  if (err.isBoom) {
    return res.status(err.output.statusCode).send({ ...err.output.payload, data: err.data });
  }
  res.status(err.status || 500);
  return res.json({
    message: err.message,
    error: {},
    title: 'error',
  });
};

module.exports = {
  routeNotFound,
  genericErrorHandling,
};
