const express = require('express');
const router = express.Router();

const friendsRoutes = require('./friends');
const messageRoutes = require('./messages');
const idGenerationRoutes = require('./idGeneration');
const dataRoutes = require('./data');
const colorsRoutes = require('./colors');

router.use('/friends', friendsRoutes);
router.use('/messages', messageRoutes);
router.use('/qrcodes', idGenerationRoutes);
router.use('/data', dataRoutes);
router.use('/colors', colorsRoutes);

module.exports = router;
