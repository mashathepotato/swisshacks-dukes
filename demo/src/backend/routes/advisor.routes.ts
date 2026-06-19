import { Router } from "express";
import { AdvisorController } from "../controllers/advisor.controller";

const router = Router();
const c = new AdvisorController();

router.get("/clients", (req, res) => c.listClients(req, res));
router.get("/inbox", (req, res) => c.inbox(req, res));
router.get("/clients/:id", (req, res) => c.getClient(req, res));
router.get("/clients/:id/alerts", (req, res) => c.getAlerts(req, res));
router.get("/clients/:id/swap", (req, res) => c.getSwap(req, res));
router.get("/clients/:id/candidates", (req, res) => c.candidates(req, res));
router.post("/clients/:id/simulate", (req, res) => c.simulate(req, res));
router.get("/clients/:id/signals", (req, res) => c.getSignals(req, res));
router.post("/clients/:id/inbound", (req, res) => c.postInbound(req, res));
router.post("/message", (req, res) => c.postMessage(req, res));

export default router;
