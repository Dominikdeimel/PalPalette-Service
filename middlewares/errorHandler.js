function errorHandler(err, req, res) {
    console.error(err);
    res.status(500).send("Test")//.json({ message: 'Internal Server Error' });
}

module.exports = errorHandler;
