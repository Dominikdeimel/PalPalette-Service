const express = require('express');
const db = require('../db');

const { asyncHandler } = require('../middlewares/asyncHandler');
const { fillColors, hexToRgb } = require('../utils/colorUtils');
//const { sendColors } = require('../utils/mqtt');
const { getTimeout } = require('../db');

const router = express.Router();

router.get(
    '/',
    asyncHandler(async (req, res) => {
        const groupId = req.query.groupId;
        const data = groupId
            ? await db.getAllFriendsInGroup(groupId)
            : await db.getAllFriends();
        res.status(200).json(data);
    })
);

router.get(
    '/:friendId',
    asyncHandler(async (req, res) => {
        try {
            const friendId = req.params.friendId;
            const data = await db.getFriend(friendId);
            res.status(200).json(data);
        } catch (err) {
            if (err.message === 'Friend not found') {
                res.sendStatus(404);
            } else {
                res.sendStatus(500);
            }
        }
    })
);

router.post(
    '/:friendId/heartbeat',
    asyncHandler(async (req, res) => {
        try {
            const friendId = req.params.friendId;
            const timestamp = new Date();
            await db.updateTimestamp(friendId, timestamp);
            res.sendStatus(204);
        } catch (err) {
            if (err.message === 'Friend not found') {
                res.sendStatus(404);
            } else {
                console.log(err);
                res.sendStatus(500);
            }
        }
    })
);

router.post(
    '/:friendId/timeout',
    asyncHandler(async (req, res) => {
        try {
            const friendId = req.params.friendId;
            const { start, end } = req.body;
            await db.setTimeout(friendId, start, end);
            res.sendStatus(200);
        } catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
    })
);

router.post(
    '/',
    asyncHandler(async (req, res) => {
        try {
            const { friendId, tileIds, groupId, name } = req.body;
            if (!friendId || !tileIds || !groupId || !name) {
                return res.sendStatus(400);
            }
            await db.createNewFriend({ friendId, tileIds, groupId });
            res.setHeader('Location', `/friends/${friendId}`);
        } catch (err) {
            if (err.message === 'Friend already exists') {
                res.status(409);
            } else {
                res.status(500);
            }
            console.error(err);
            return res.send();
        }
        res.sendStatus(201);
    })
);

router.patch(
    '/:friendId',
    asyncHandler(async (req, res) => {
        const data = req.body;
        try {
            await db.getFriend(req.params.friendId);
        } catch (err) {
            if (err.message === 'Friend not found') {
                await db.createNewFriend(data);
                return res.sendStatus(201);
            }
        }
        try {
            await db.pingFriend(data);
        } catch (err) {
            console.log(err);
            return res.sendStatus(500);
        }

        res.sendStatus(204);
    })
);

const mapColorsToTileIds = (tileIds, colors) => {
    let finalColors;
    if (tileIds.length > colors.length) {
        finalColors = fillColors(colors, tileIds.length);
    } else {
        finalColors = colors;
    }

    const rgbColors = finalColors.map(hexToRgb);

    return tileIds.reduce((acc, tileId, index) => {
        acc[tileId] = rgbColors[index];
        return acc;
    }, {});
};

router.post(
    '/colors',
    asyncHandler(async (req, res) => {
        try {
            const { colors, fromFriendId, toFriendIds } = req.body;
            const imageData = JSON.parse(req.body.imageData);

            const fromFriend = await db.getFriend(fromFriendId);
            if (!fromFriend) {
                return res.status(404).json({ error: 'From Friend not found' });
            }

            const promises = toFriendIds.map(async (toFriendId) => {
                try {
                    const friend = await db.getFriend(toFriendId);
                    if (!friend) throw new Error('Friend not found');

                    const colorMapping = mapColorsToTileIds(
                        friend.tileIds,
                        colors
                    );

                    const timeout = await getTimeout(toFriendId);
                    const currentDate = new Date();
                    const currentMinutes =
                        currentDate.getHours() * 60 + currentDate.getMinutes();
                    const startMinutes =
                        parseInt(timeout.start.split(':')[0]) * 60 +
                        parseInt(timeout.start.split(':')[1]);
                    const endMinutes =
                        parseInt(timeout.end.split(':')[0]) * 60 +
                        parseInt(timeout.end.split(':')[1]);

                    if (
                        currentMinutes >= startMinutes &&
                        currentMinutes <= endMinutes
                    ) {
                        // If message received outside of friends timeout
                        /*await sendColors(
                            toFriendId,
                            colorMapping,
                            fromFriend.color
                        );*/
                    }
                    await db.saveMessage({
                        colors,
                        toFriendId,
                        fromFriendId,
                    });
                } catch (error) {
                    console.error(
                        `Failed to process friendID ${toFriendId}`,
                        error
                    );
                    return { success: false, error: error.message };
                }

                return { success: true, toFriendId };
            });

            const results = await Promise.allSettled(promises);
            const successes = results.filter(
                (result) =>
                    result.status === 'fulfilled' && result.value.success
            );
            const failures = results.filter(
                (result) =>
                    result.status === 'rejected' || !result.value.success
            );

            let message = {
                from: fromFriend.friendId,
                to: toFriendIds,
                at: new Date(),
                colors: colors,
                imageData: imageData,
            };

            db.saveMessageData(message);

            // Send back a general status or specific details
            if (successes.length === toFriendIds.length) {
                return res.sendStatus(200);
            } else {
                return res.status(207).json({
                    message: 'Completed with some errors',
                    successes,
                    failures,
                });
            }
        } catch (err) {
            console.error('Error handling colors:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    })
);

router.post(
    '/:friendId/colors',
    asyncHandler(async (req, res) => {
        try {
            const { colors, fromFriendId } = req.body;
            const { friendId } = req.params;
            const shouldSaveMessage = req.query.shouldSaveMessage || true;
            const friend = await db.getFriend(friendId);
            const fromFriend = await db.getFriend(fromFriendId);

            if (!friend || !friend.tileIds || !fromFriend) {
                throw new Error('Friend not found');
            }

            const fromFriendColor = fromFriend.color;

            const colorMapping = mapColorsToTileIds(friend.tileIds, colors);
            /*if (friend.tileIds.length === 0) {
                // Friend is not online => Colors were successfully appended to friends queue
                await db.addToQueue(friendId, colors);
                res.sendStatus(202); // Send 202 Accepted status
            } else {
                /sendColors(friendId, colorMapping, fromFriendColor)
                    .then(() => {
                        if (
                            shouldSaveMessage === true ||
                            shouldSaveMessage === 'true'
                        ) {
                            db.saveMessage({
                                colors,
                                toFriendId: friendId,
                                fromFriendId,
                            });
                        }
                        res.sendStatus(200);
                    })
                    .catch((err) => {
                        console.error(err);
                        res.sendStatus(500);
                    });
            }*/
        } catch (err) {
            if (err.message === 'Friend not found') {
                res.sendStatus(404);
            } else {
                res.sendStatus(500);
            }
        }
    })
);

module.exports = router;
