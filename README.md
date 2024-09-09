# GeoGlow Service

This is the Backend-Service (or the ❤️) of GeoGlow.
It is responsible for:

1. Managing the device <-> friend relationship
2. Persisting friend and device data
3. Providing an API for the devices and friends to register
4. Providing an API for retrieving the Friend information

## Routes

The Service will provide the following routes

### App

- [x] `GET /friends`
- [x] `GET /friends?groupId={groupId}`
- [x] `GET /friends/{friendId}`
- [x] `POST /friends/{friendId}/colors`
- [x] `PATCH /friends/{friendId}`

### Admin

- [ ] `POST /groups`
- [ ] `POST /groups/{groupId}/friends`
- [ ] `DELETE /groups/{groupId}`
- [ ] `DELETE /groups/{groupId}/friends/{friendId}`
- [ ] `PATCH /groups/{groupId}`

## Health Check

- [ ] `GET /health`
