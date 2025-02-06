const express = require('express');
const path = require('path');
const db = require('../db');
const { extractColors } = require('extract-colors');
const getPixels = require('get-pixels');

const { asyncHandler } = require('../middlewares/asyncHandler');
const { diskStorage } = require('multer');
const multer = require('multer');
const { existsSync, mkdirSync } = require('node:fs');

const router = express.Router();

const UPLOADS_FOLDER = path.join(__dirname, '../uploads');
if (!existsSync(UPLOADS_FOLDER)) {
    mkdirSync(UPLOADS_FOLDER);
}

const storage = diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_FOLDER);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only images are allowed!'));
    }
};

const upload = multer({
    storage: storage,
    limits: {fileSize: 5 * 1024 * 1024}, // 5MB
    fileFilter: fileFilter,
})

router.post(
    '/upload',
    upload.single('image'),
    asyncHandler(async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: 'Please upload an image!' });
        }

        const imagePath = req.file.path;

        getPixels(imagePath, (err, pixels) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Failed to process image pixels.'});
            }

            const data = [...pixels.data]
            const [width, height] = pixels.shape

            const options = {
                pixels: 64000,
                distance: 0.20,
                colorValidator: (red, green, blue, alpha = 255) => alpha > 250,
                saturationDistance: 0.2,
                lightnessDistance: 0.2,
                hueDistance: 0.083333333
            }

            extractColors({ data, width, height }, options).then(colors => {
                res.status(200).json({
                    message: 'Successfully uploaded!',
                    filePath: imagePath,
                    colors: colors
                });
            }).catch(error => {
                console.error(error);
                res.status(500).json({ error: 'Failed to process image pixels.' });
            })
        })
    })
);

module.exports = router;
