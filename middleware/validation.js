const { validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  return res.status(422).json({
    success: false,
    message: 'Validation Failed',
    errors: errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }))
  });
};

module.exports = { handleValidationErrors };
