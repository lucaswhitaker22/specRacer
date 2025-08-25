"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PlayerService_1 = require("../services/PlayerService");
const router = (0, express_1.Router)();
const playerService = new PlayerService_1.PlayerService();
router.post('/register', async (req, res) => {
    try {
        const registerData = req.body;
        if (!registerData.username || !registerData.email || !registerData.password) {
            res.status(400).json({
                error: 'Username, email, and password are required'
            });
            return;
        }
        const [usernameAvailable, emailAvailable] = await Promise.all([
            playerService.isUsernameAvailable(registerData.username),
            playerService.isEmailAvailable(registerData.email)
        ]);
        if (!usernameAvailable) {
            res.status(409).json({
                error: 'Username is already taken'
            });
            return;
        }
        if (!emailAvailable) {
            res.status(409).json({
                error: 'Email is already registered'
            });
            return;
        }
        const player = await playerService.registerPlayer(registerData);
        res.status(201).json({
            message: 'Player registered successfully',
            player: {
                id: player.id,
                username: player.username,
                email: player.email,
                createdAt: player.createdAt
            }
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({
            error: error instanceof Error ? error.message : 'Registration failed'
        });
    }
});
router.post('/login', async (req, res) => {
    try {
        const credentials = req.body;
        if (!credentials.username || !credentials.password) {
            res.status(400).json({
                error: 'Username and password are required'
            });
            return;
        }
        const authToken = await playerService.authenticatePlayer(credentials);
        const player = await playerService.getPlayerById(authToken.playerId);
        if (!player) {
            res.status(404).json({
                error: 'Player not found'
            });
            return;
        }
        res.json({
            message: 'Login successful',
            token: authToken.token,
            expiresAt: authToken.expiresAt,
            player: {
                id: player.id,
                username: player.username,
                email: player.email,
                totalRaces: player.totalRaces,
                wins: player.wins,
                leaguePoints: player.leaguePoints
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(401).json({
            error: error instanceof Error ? error.message : 'Authentication failed'
        });
    }
});
router.post('/verify', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            res.status(400).json({
                error: 'Token is required'
            });
            return;
        }
        const playerId = await playerService.verifyToken(token);
        const player = await playerService.getPlayerById(playerId);
        if (!player) {
            res.status(404).json({
                error: 'Player not found'
            });
            return;
        }
        res.json({
            valid: true,
            player: {
                id: player.id,
                username: player.username,
                email: player.email,
                totalRaces: player.totalRaces,
                wins: player.wins,
                leaguePoints: player.leaguePoints
            }
        });
    }
    catch (error) {
        res.status(401).json({
            valid: false,
            error: error instanceof Error ? error.message : 'Invalid token'
        });
    }
});
router.get('/check-username/:username', async (req, res) => {
    try {
        const { username } = req.params;
        if (!username || username.length < 3) {
            res.status(400).json({
                error: 'Username must be at least 3 characters long'
            });
            return;
        }
        const available = await playerService.isUsernameAvailable(username);
        res.json({
            username,
            available
        });
    }
    catch (error) {
        console.error('Username check error:', error);
        res.status(500).json({
            error: 'Failed to check username availability'
        });
    }
});
router.get('/check-email/:email', async (req, res) => {
    try {
        const { email } = req.params;
        if (!email || !email.includes('@')) {
            res.status(400).json({
                error: 'Valid email is required'
            });
            return;
        }
        const available = await playerService.isEmailAvailable(email);
        res.json({
            email,
            available
        });
    }
    catch (error) {
        console.error('Email check error:', error);
        res.status(500).json({
            error: 'Failed to check email availability'
        });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map