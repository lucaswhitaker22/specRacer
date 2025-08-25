"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CarService_1 = require("../services/CarService");
const router = (0, express_1.Router)();
router.get('/', (req, res) => {
    try {
        const cars = CarService_1.CarService.getAvailableCars();
        res.json({
            success: true,
            data: cars
        });
    }
    catch (error) {
        console.error('Error fetching cars:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch available cars'
        });
    }
});
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const car = CarService_1.CarService.getCarById(id);
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
    }
    catch (error) {
        console.error('Error fetching car:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch car'
        });
    }
});
exports.default = router;
//# sourceMappingURL=cars.js.map