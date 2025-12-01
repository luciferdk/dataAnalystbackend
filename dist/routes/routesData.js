"use strict";
// src/routes/routesData.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const controller_health_1 = __importDefault(require("../controller/controller.health"));
const controller_covid_1 = __importDefault(require("../controller/controller.covid"));
const controller_prediction_1 = __importDefault(require("../controller/controller.prediction"));
const router = express_1.default.Router();
// Define your routes with proper types
router.get("/healthData", (req, res) => (0, controller_health_1.default)(req, res));
router.get("/covidData", (req, res) => (0, controller_covid_1.default)(req, res));
router.get("/prediction", (req, res) => (0, controller_prediction_1.default)(req, res));
exports.default = router;
