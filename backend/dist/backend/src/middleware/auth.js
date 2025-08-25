"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.optionalAuth = optionalAuth;
const PlayerService_1 = require("../services/PlayerService");
const playerService = new PlayerService_1.PlayerService();
async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({
                error: 'Access token required'
            });
            return;
        }
        const playerId = await playerService.verifyToken(token);
        req.playerId = playerId;
        next();
    }
    catch (error) {
        res.status(403).json({
            error: 'Invalid or expired token'
        });
    }
}
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            const playerId = await playerService.verifyToken(token);
            req.playerId = playerId;
        }
        next();
    }
    catch (error) {
        next();
    }
}
//# sourceMappingURL=auth.js.map