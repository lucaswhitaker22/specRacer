import request from 'supertest';
import express from 'express';
import authRoutes from '../auth';
import { PlayerService } from '../../services/PlayerService';

// Mock PlayerService
jest.mock('../../services/PlayerService', () => {
  return {
    PlayerService: jest.fn().mockImplementation(() => ({
      registerPlayer: jest.fn(),
      authenticatePlayer: jest.fn(),
      verifyToken: jest.fn(),
      getPlayerById: jest.fn(),
      isUsernameAvailable: jest.fn(),
      isEmailAvailable: jest.fn()
    }))
  };
});

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Routes', () => {
  let mockPlayerService: any;

  beforeEach(() => {
    // Get a fresh instance of the mocked service
    const { PlayerService } = require('../../services/PlayerService');
    mockPlayerService = new PlayerService();
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    const validRegisterData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    };

    it('should register a new player successfully', async () => {
      const mockPlayer = {
        id: 'player-id-123',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: new Date(),
        totalRaces: 0,
        wins: 0,
        leaguePoints: 0
      };

      mockPlayerService.isUsernameAvailable.mockResolvedValue(true);
      mockPlayerService.isEmailAvailable.mockResolvedValue(true);
      mockPlayerService.registerPlayer.mockResolvedValue(mockPlayer);

      const response = await request(app)
        .post('/auth/register')
        .send(validRegisterData)
        .expect(201);

      expect(response.body.message).toBe('Player registered successfully');
      expect(response.body.player.username).toBe('testuser');
      expect(mockPlayerService.registerPlayer).toHaveBeenCalledWith(validRegisterData);
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({ username: 'testuser' })
        .expect(400);

      expect(response.body.error).toBe('Username, email, and password are required');
    });

    it('should return 409 for existing username', async () => {
      mockPlayerService.isUsernameAvailable.mockResolvedValue(false);
      mockPlayerService.isEmailAvailable.mockResolvedValue(true);

      const response = await request(app)
        .post('/auth/register')
        .send(validRegisterData)
        .expect(409);

      expect(response.body.error).toBe('Username is already taken');
    });

    it('should return 409 for existing email', async () => {
      mockPlayerService.isUsernameAvailable.mockResolvedValue(true);
      mockPlayerService.isEmailAvailable.mockResolvedValue(false);

      const response = await request(app)
        .post('/auth/register')
        .send(validRegisterData)
        .expect(409);

      expect(response.body.error).toBe('Email is already registered');
    });
  });

  describe('POST /auth/login', () => {
    const validCredentials = {
      username: 'testuser',
      password: 'password123'
    };

    it('should login successfully with valid credentials', async () => {
      const mockAuthToken = {
        token: 'jwt-token',
        expiresAt: new Date(),
        playerId: 'player-id-123'
      };

      const mockPlayer = {
        id: 'player-id-123',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: new Date(),
        totalRaces: 5,
        wins: 2,
        leaguePoints: 100
      };

      mockPlayerService.authenticatePlayer.mockResolvedValue(mockAuthToken);
      mockPlayerService.getPlayerById.mockResolvedValue(mockPlayer);

      const response = await request(app)
        .post('/auth/login')
        .send(validCredentials)
        .expect(200);

      expect(response.body.message).toBe('Login successful');
      expect(response.body.token).toBe('jwt-token');
      expect(response.body.player.username).toBe('testuser');
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'testuser' })
        .expect(400);

      expect(response.body.error).toBe('Username and password are required');
    });

    it('should return 401 for invalid credentials', async () => {
      mockPlayerService.authenticatePlayer.mockRejectedValue(new Error('Invalid username or password'));

      const response = await request(app)
        .post('/auth/login')
        .send(validCredentials)
        .expect(401);

      expect(response.body.error).toBe('Invalid username or password');
    });
  });

  describe('POST /auth/verify', () => {
    it('should verify valid token', async () => {
      const mockPlayer = {
        id: 'player-id-123',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: new Date(),
        totalRaces: 5,
        wins: 2,
        leaguePoints: 100
      };

      mockPlayerService.verifyToken.mockResolvedValue('player-id-123');
      mockPlayerService.getPlayerById.mockResolvedValue(mockPlayer);

      const response = await request(app)
        .post('/auth/verify')
        .send({ token: 'valid-token' })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.player.username).toBe('testuser');
    });

    it('should return 400 for missing token', async () => {
      const response = await request(app)
        .post('/auth/verify')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Token is required');
    });

    it('should return 401 for invalid token', async () => {
      mockPlayerService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      const response = await request(app)
        .post('/auth/verify')
        .send({ token: 'invalid-token' })
        .expect(401);

      expect(response.body.valid).toBe(false);
    });
  });

  describe('GET /auth/check-username/:username', () => {
    it('should return availability for valid username', async () => {
      mockPlayerService.isUsernameAvailable.mockResolvedValue(true);

      const response = await request(app)
        .get('/auth/check-username/newuser')
        .expect(200);

      expect(response.body.username).toBe('newuser');
      expect(response.body.available).toBe(true);
    });

    it('should return 400 for short username', async () => {
      const response = await request(app)
        .get('/auth/check-username/ab')
        .expect(400);

      expect(response.body.error).toBe('Username must be at least 3 characters long');
    });
  });

  describe('GET /auth/check-email/:email', () => {
    it('should return availability for valid email', async () => {
      mockPlayerService.isEmailAvailable.mockResolvedValue(true);

      const response = await request(app)
        .get('/auth/check-email/new@example.com')
        .expect(200);

      expect(response.body.email).toBe('new@example.com');
      expect(response.body.available).toBe(true);
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .get('/auth/check-email/invalid-email')
        .expect(400);

      expect(response.body.error).toBe('Valid email is required');
    });
  });
});