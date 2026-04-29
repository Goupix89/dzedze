"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const audit_controller_1 = require("../controllers/audit.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('admin', 'manager'));
router.get('/', audit_controller_1.listAuditLogs);
router.get('/stats', audit_controller_1.getAuditStats);
exports.default = router;
//# sourceMappingURL=audit.routes.js.map