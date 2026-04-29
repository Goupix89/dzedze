import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getDashboardStats,
  getQualityTrend,
  listMissions,
  createMission,
  getMission,
  updateMission,
  deleteMission,
  startMission,
  completeMission,
  scoreMission,
  updateChecklist,
  submitMissionReport,
  getMissionHistory,
} from '../controllers/mission.controller';

const router = Router();

router.use(authenticate);

// Dashboard
router.get('/stats', getDashboardStats);
router.get('/quality-trend', getQualityTrend);

// CRUD
router.get('/', listMissions);
router.get('/history', getMissionHistory);
router.post('/', createMission);
router.get('/:id', getMission);
router.put('/:id', updateMission);
router.delete('/:id', deleteMission);

// Lifecycle
router.post('/:id/start', startMission);
router.post('/:id/complete', completeMission);
router.post('/:id/report', submitMissionReport);
router.post('/:id/score', scoreMission);

// Checklist
router.patch('/:id/checklist', updateChecklist);

export default router;
