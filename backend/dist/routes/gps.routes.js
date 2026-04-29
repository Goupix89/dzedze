"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const gps_controller_1 = require("../controllers/gps.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.post('/checkin', gps_controller_1.createGpsCheckin);
router.get('/agents/:id/last-location', gps_controller_1.getAgentLastLocation);
exports.default = router;
//# sourceMappingURL=gps.routes.js.map