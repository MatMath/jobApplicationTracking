// This is to have generic error handling for later.

const routeNotFound = (req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
};

const genericErrorHandling = (err, req, res, next) => {
  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: {},
    title: 'error',
  });
};

const customError = (msg, code) => {
  const tmp = new Error(msg);
  tmp.status = code;
  return tmp;
};

module.exports = {
  routeNotFound,
  genericErrorHandling,
  customError,
};
