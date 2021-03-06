// This is to have generic error handling for later.

export const routeNotFound = (req, res, next) => {
  const err = new Error('Not Found');
  res.status = 404;
  next(err);
};

// 4 argument needed for express to know it is error handling
export const genericErrorHandling = (err, req, res, next) => { // eslint-disable-line no-unused-vars
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
