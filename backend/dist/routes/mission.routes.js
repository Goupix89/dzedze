"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const mission_controller_1 = require("../controllers/mission.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Dashboard
router.get('/stats', mission_controller_1.getDashboardStats);
router.get('/quality-trend', mission_controller_1.getQualityTrend);
// CRUD
router.get('/', mission_controller_1.listMissions);
router.get('/history', mission_controller_1.getMissionHistory);
router.post('/', mission_controller_1.createMission);
router.get('/:id', mission_controller_1.getMission);
router.put('/:id', mission_controller_1.updateMission);
router.delete('/:id', mission_controller_1.deleteMission);
// Lifecycle
router.post('/:id/start', mission_controller_1.startMission);
router.post('/:id/complete', mission_controller_1.completeMission);
router.post('/:id/report', mission_controller_1.submitMissionReport);
router.post('/:id/score', mission_controller_1.scoreMission);
// Checklist
router.patch('/:id/checklist', mission_controller_1.updateChecklist);
exports.default = router;
//# sourceMappingURL=mission.routes.js.map