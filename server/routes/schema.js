const express = require('express');
const schema = require('../schema.json');
const router = express.Router();

router.get('/', (req, res) => {
  res.json(schema);
});

module.exports = router;
