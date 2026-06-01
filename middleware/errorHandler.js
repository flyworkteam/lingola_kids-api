const parseDuplicateEntryError = (err) => {
  const message = err.message || '';
  const keyMatch = message.match(/for key '([^']+)'/);
  const keyName = keyMatch ? keyMatch[1] : 'unknown';
  return {
    keyName,
    suggestion: 'This record already exists.'
  };
};

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let error = null;

  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    const duplicate = parseDuplicateEntryError(err);
    message = 'Database Constraint Violation: Duplicate Entry';
    error = {
      type: 'DUPLICATE_ENTRY',
      constraint: duplicate.keyName,
      suggestion: duplicate.suggestion
    };
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    message = 'Database Constraint Violation: Foreign Key Error';
    error = { type: 'FOREIGN_KEY_VIOLATION' };
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication Error';
    error = {
      type: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      requiresTokenRefresh: err.name === 'TokenExpiredError'
    };
  } else if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    statusCode = 503;
    message = 'Database Connection Error';
    error = { type: 'DATABASE_CONNECTION_ERROR' };
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(error ? { error } : {})
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
};

module.exports = { errorHandler, notFoundHandler };
