import { CarModel } from '../../../shared/types';
export declare class CarService {
    private static cars;
    static initialize(): void;
    static getAvailableCars(): CarModel[];
    static getCarById(carId: string): CarModel | null;
    static calculateAcceleration(car: CarModel, currentSpeed: number): number;
    static calculateBrakingDeceleration(car: CarModel, currentSpeed: number): number;
    static calculateTopSpeed(car: CarModel): number;
    static calculateFuelConsumption(car: CarModel, currentSpeed: number, throttlePosition: number): number;
    static calculateTireWearRate(car: CarModel, currentSpeed: number, lateralG: number, brakingG: number): number;
    private static getDrivetrainEfficiency;
    private static getSeededCars;
}
//# sourceMappingURL=CarService.d.ts.map