import { Router } from 'express';
import { CarService } from '../services/CarService';

const router = Router();

/**
 * GET /api/cars
 * Get all available car models
 */
router.get('/', (req, res) => {
  try {
    const cars = CarService.getAvailableCars();
    res.json({
      success: true,
      data: cars
    });
  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available cars'
    });
  }
});

/**
 * GET /api/cars/:id
 * Get a specific car by ID
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const car = CarService.getCarById(id);
    
    if (!car) {
      return res.status(404).json({
        success: false,
        error: 'Car not found'
      });
    }
    
    return res.json({
      success: true,
      data: car
    });
  } catch (error) {
    console.error('Error fetching car:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch car'
    });
  }
});

export default router;