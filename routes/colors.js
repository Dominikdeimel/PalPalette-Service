const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { asyncHandler } = require('../middlewares/asyncHandler');
const ColorThief = require('colorthief');
const { hexToRgb } = require('../utils/colorUtils');

const router = express.Router();

/**
 * Multer with Memory Limits to Prevent Overload
 */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024, // Limit file size to 2MB
        files: 1, // Only allow 1 file per request
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'));
        }
        cb(null, true);
    },
});

/**
 * Middleware: Automatically preprocess uploaded images before they reach the route
 */
const preprocessImageMiddleware = async (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Please upload an image!' });
    }

    try {
        // Preprocess the image and overwrite the buffer
        req.file.buffer = await sharp(req.file.buffer)
            .resize(300)    // Resize to 300px
            .removeAlpha()                 // Remove transparency
            .modulate({ saturation: 1.2 })  // Boost saturation
            .toBuffer();

        next();
    } catch (error) {
        console.error('Error preprocessing image:', error);
        return res.status(500).json({ error: 'Image processing failed' });
    }
};

router.post(
    '/upload',
    upload.single('image'),
    preprocessImageMiddleware,
    asyncHandler(async (req, res) => {
        try {
            const colors = await ColorThief.getPalette(req.file.buffer, 16);

            // Free memory after processing
            req.file.buffer = null;
            req.file = null;

            return res.status(200).json({ colors: colors });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
    })
);

module.exports = router;
