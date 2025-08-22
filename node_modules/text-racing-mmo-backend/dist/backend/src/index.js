"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsServer = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const index_1 = require("./websocket/index");
const CarService_1 = require("./services/CarService");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 3000;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}));
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'text-racing-mmo-backend'
    });
});
CarService_1.CarService.initialize();
const wsServer = new index_1.WebSocketServer(httpServer);
exports.wsServer = wsServer;
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await wsServer.shutdown();
    httpServer.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await wsServer.shutdown();
    httpServer.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
httpServer.listen(PORT, () => {
    console.log(`Text Racing MMO Backend running on port ${PORT}`);
    console.log(`WebSocket server ready for connections`);
});
//# sourceMappingURL=index.js.map