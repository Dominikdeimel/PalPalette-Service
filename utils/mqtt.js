const mqtt = require('mqtt');
const config = require('../config/config');
const { getTimeout } = require('../db');

const options = {
    host: config.mqttUrl,
    port: config.mqttPort,
};

const client = mqtt.connect(options);

// Event listeners for MQTT client
client.on('connect', function () {
    console.log('Connected to MQTT broker');
});

client.on('error', function (error) {
    console.error('MQTT connection error: ', error);
});

function sendColors(friendId, colors, fromFriendColor) {
    return new Promise(async (resolve, reject) => {
        const timeout = await getTimeout(friendId);
        const currentDate = new Date()
        const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
        const startMinutes = parseInt(timeout.start.split(":")[0]) * 60 + parseInt(timeout.start.split(":")[1]);
        const endMinutes = parseInt(timeout.end.split(":")[0]) * 60 + parseInt(timeout.end.split(":")[1]);

        if(currentMinutes >= startMinutes && currentMinutes <= endMinutes) { // If message received outside of friends timeout
            let payload = { ...colors, fromFriendColor };
            payload = JSON.stringify(payload);
            const topic = `GeoGlow/${friendId}/color`;
            client.publish(topic, payload, { qos: 1 }, (err) => {
                if (err) {
                    console.error('Failed to publish message', err);
                    reject(err);
                } else {
                    resolve(true);
                }
            });
        } else {
            resolve(true); // If message received during timeout, just resolve but do not send colors to nanoleafs
        }
    });
}

module.exports = {
    client,
    sendColors,
};
