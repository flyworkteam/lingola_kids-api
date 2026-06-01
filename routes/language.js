const express = require('express');
const { getAvailableLanguages } = require('../controllers/languageController');

const router = express.Router();

router.get('/', getAvailableLanguages);

module.exports = router;
