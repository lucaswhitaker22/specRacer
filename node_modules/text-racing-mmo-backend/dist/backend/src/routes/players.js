"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PlayerService_1 = require("../services/PlayerService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const playerService = new PlayerService_1.PlayerService();
router.get('/profile', auth_1.authenticateToken, async (req, res) => {
    try {
        const playerId = req.playerId;
        const profile = await playerService.getPlayerProfile(playerId);
        if (!profile) {
            res.status(404).json({
                error: 'Player profile not found'
            });
            return;
        }
        res.json({
            profile
        });
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            error: 'Failed to retrieve player profile'
        });
    }
});
router.put('/profile', auth_1.authenticateToken, async (req, res) => {
    try {
        const playerId = req.playerId;
        const updates = req.body;
        const allowedUpdates = { email: updates.email };
        const updatedPlayer = await playerService.updatePlayerProfile(playerId, allowedUpdates);
        res.json({
            message: 'Profile updated successfully',
            player: updatedPlayer
        });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(400).json({
            error: error instanceof Error ? error.message : 'Failed to update profile'
        });
    }
});
router.get('/race-history', auth_1.authenticateToken, async (req, res) => {
    try {
        const playerId = req.playerId;
        const limit = parseInt(req.query.limit) || 50;
        const raceHistory = await playerService.getPlayerRaceHistory(playerId, limit);
        res.json({
            raceHistory
        });
    }
    catch (error) {
        console.error('Get race history error:', error);
        res.status(500).json({
            error: 'Failed to retrieve race history'
        });
    }
});
router.get('/statistics', auth_1.authenticateToken, async (req, res) => {
    try {
        const playerId = req.playerId;
        const statistics = await playerService.calculatePlayerStatistics(playerId);
        res.json({
            statistics
        });
    }
    catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({
            error: 'Failed to retrieve player statistics'
        });
    }
});
router.get('/league-standings', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const standings = await playerService.getLeagueStandings(limit);
        res.json({
            standings
        });
    }
    catch (error) {
        console.error('Get league standings error:', error);
        res.status(500).json({
            error: 'Failed to retrieve league standings'
        });
    }
});
router.get('/league-position', auth_1.authenticateToken, async (req, res) => {
    try {
        const playerId = req.playerId;
        const position = await playerService.getPlayerLeaguePosition(playerId);
        res.json({
            position
        });
    }
    catch (error) {
        console.error('Get league position error:', error);
        res.status(500).json({
            error: 'Failed to retrieve league position'
        });
    }
});
router.get('/:playerId', async (req, res) => {
    try {
        const { playerId } = req.params;
        const player = await playerService.getPlayerById(playerId);
        if (!player) {
            res.status(404).json({
                error: 'Player not found'
            });
            return;
        }
        res.json({
            player: {
                id: player.id,
                username: player.username,
                totalRaces: player.totalRaces,
                wins: player.wins,
                leaguePoints: player.leaguePoints
            }
        });
    }
    catch (error) {
        console.error('Get player error:', error);
        res.status(500).json({
            error: 'Failed to retrieve player information'
        });
    }
});
router.delete('/account', auth_1.authenticateToken, async (req, res) => {
    try {
        const playerId = req.playerId;
        await playerService.deactivatePlayer(playerId);
        res.json({
            message: 'Account deactivated successfully'
        });
    }
    catch (error) {
        console.error('Deactivate account error:', error);
        res.status(500).json({
            error: 'Failed to deactivate account'
        });
    }
});
exports.default = router;
//# sourceMappingURL=players.js.map