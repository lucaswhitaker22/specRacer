import request from 'supertest';
import express from 'express';
import carRoutes from '../cars';
import { CarService } from '../../services/CarService';

// Mock the CarService
jest.mock('../../services/CarService');
const mockCarService = CarService as jest.Mocked<typeof CarService>;

const app = express();
app.use(express.json());
app.use('/api/cars', carRoutes);

describe('Cars Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/cars', () => {
    it('should return all available cars', async () => {
      const mockCars = [
        {
          id: 'honda-civic-type-r-2023',
          name: 'Civic Type R',
          manufacturer: 'Honda',
          year: 2023,
          specifications: {
            horsepower: 315,
            weight: 1429,
            dragCoefficient: 0.37,
            frontalArea: 2.3,
            drivetrain: 'FWD' as const,
            tireGrip: 1.1,
            gearRatios: [3.267, 2.130, 1.517, 1.147, 0.921, 0.738],
            aeroDownforce: 85,
            fuelEconomy: 8.7,
            zeroToSixty: 5.4,
            topSpeed: 272
          },
          licensing: {
            source: 'Honda Motor Co., Ltd.',
            validUntil: new Date('2025-12-31'),
            restrictions: ['Non-commercial use only']
          }
        }
      ];

      mockCarService.getAvailableCars.mockReturnValue(mockCars);

      const response = await request(app)
        .get('/api/cars')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(mockCars[0].id);
      expect(response.body.data[0].name).toBe(mockCars[0].name);
      expect(mockCarService.getAvailableCars).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors', async () => {
      mockCarService.getAvailableCars.mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .get('/api/cars')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch available cars'
      });
    });
  });

  describe('GET /api/cars/:id', () => {
    it('should return a specific car by ID', async () => {
      const mockCar = {
        id: 'honda-civic-type-r-2023',
        name: 'Civic Type R',
        manufacturer: 'Honda',
        year: 2023,
        specifications: {
          horsepower: 315,
          weight: 1429,
          dragCoefficient: 0.37,
          frontalArea: 2.3,
          drivetrain: 'FWD' as const,
          tireGrip: 1.1,
          gearRatios: [3.267, 2.130, 1.517, 1.147, 0.921, 0.738],
          aeroDownforce: 85,
          fuelEconomy: 8.7,
          zeroToSixty: 5.4,
          topSpeed: 272
        },
        licensing: {
          source: 'Honda Motor Co., Ltd.',
          validUntil: new Date('2025-12-31'),
          restrictions: ['Non-commercial use only']
        }
      };

      mockCarService.getCarById.mockReturnValue(mockCar);

      const response = await request(app)
        .get('/api/cars/honda-civic-type-r-2023')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockCar.id);
      expect(response.body.data.name).toBe(mockCar.name);
      expect(mockCarService.getCarById).toHaveBeenCalledWith('honda-civic-type-r-2023');
    });

    it('should return 404 for non-existent car', async () => {
      mockCarService.getCarById.mockReturnValue(null);

      const response = await request(app)
        .get('/api/cars/non-existent-car')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Car not found'
      });
    });

    it('should handle service errors', async () => {
      mockCarService.getCarById.mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .get('/api/cars/honda-civic-type-r-2023')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch car'
      });
    });
  });
});