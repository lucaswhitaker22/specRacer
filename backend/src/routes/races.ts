import { Router, Request, Response } from 'express';
import { RaceService } from '../services/RaceService';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const raceService = new RaceService();

/**
 * Create a new race
 */
router.post('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { trackId, totalLaps, maxParticipants } = req.body;
    
    if (!trackId || !totalLaps) {
      res.status(400).json({
        error: 'trackId and totalLaps are required'
      });
      return;
    }

    const raceId = await raceService.createRace({
      trackId,
      totalLaps,
      maxParticipants
    });

    res.status(201).json({
      success: true,
      raceId,
      message: 'Race created successfully'
    });
  } catch (error) {
    console.error('Create race error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create race'
    });
  }
});

/**
 * Join a race
 */
router.post('/:raceId/join', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { raceId } = req.params;
    const { carId } = req.body;
    const playerId = (req as any).playerId;

    if (!carId) {
      res.status(400).json({
        error: 'carId is required'
      });
      return;
    }

    const success = await raceService.joinRace(raceId, {
      playerId,
      carId
    });

    if (success) {
      res.json({
        success: true,
        message: 'Successfully joined race'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to join race'
      });
    }
  } catch (error) {
    console.error('Join race error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to join race'
    });
  }
});

/**
 * Leave a race
 */
router.post('/:raceId/leave', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { raceId } = req.params;
    const playerId = (req as any).playerId;

    const success = await raceService.leaveRace(raceId, playerId);

    if (success) {
      res.json({
        success: true,
        message: 'Successfully left race'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to leave race'
      });
    }
  } catch (error) {
    console.error('Leave race error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to leave race'
    });
  }
});

/**
 * Start a race
 */
router.post('/:raceId/start', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { raceId } = req.params;

    const success = await raceService.startRace(raceId);

    if (success) {
      res.json({
        success: true,
        message: 'Race started successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to start race'
      });
    }
  } catch (error) {
    console.error('Start race error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start race'
    });
  }
});

/**
 * Get race state
 */
router.get('/:raceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { raceId } = req.params;

    const raceState = await raceService.getRaceState(raceId);

    if (raceState) {
      res.json({
        success: true,
        raceState
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Race not found'
      });
    }
  } catch (error) {
    console.error('Get race state error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get race state'
    });
  }
});

/**
 * Get available races
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const races = await raceService.getAvailableRaces();

    res.json({
      success: true,
      races
    });
  } catch (error) {
    console.error('Get available races error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get available races'
    });
  }
});

/**
 * Get race results
 */
router.get('/:raceId/results', async (req: Request, res: Response): Promise<void> => {
  try {
    const { raceId } = req.params;

    const results = await raceService.getRaceResults(raceId);

    if (results) {
      res.json({
        success: true,
        results
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Race results not found'
      });
    }
  } catch (error) {
    console.error('Get race results error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get race results'
    });
  }
});

export default router;