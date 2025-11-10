
// src/routes/routesData.ts
import express, { Router, Request, Response } from "express";
import getHealthData from "../controller/controller.health";
import getCovidData from "../controller/controller.covid";

const router: Router = express.Router();

// Define your routes with proper types
router.get("/healthData", (req: Request, res: Response) => getHealthData(req, res));
router.get("/covidData", (req: Request, res: Response) => getCovidData(req, res));

export default router;
