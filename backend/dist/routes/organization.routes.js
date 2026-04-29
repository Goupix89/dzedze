"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const organization_controller_1 = require("../controllers/organization.controller");
const router = (0, express_1.Router)();
router.get('/plans', organization_controller_1.listPlans); // public — used by signup page
router.use(auth_middleware_1.authenticate);
router.get('/me', (0, auth_middleware_1.requireRole)('admin', 'manager'), organization_controller_1.getMyOrg);
router.post('/upgrade', (0, auth_middleware_1.requireRole)('admin', 'manager'), organization_controller_1.upgradePlan);
exports.default = router;
//# sourceMappingURL=organization.routes.js.map