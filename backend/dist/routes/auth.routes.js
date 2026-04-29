"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post('/login', auth_controller_1.login);
router.post('/signup', auth_controller_1.signup); // public — manager self-registration
router.post('/register', auth_middleware_1.authenticate, auth_controller_1.register); // manager creates agents in their org
router.post('/consent', auth_middleware_1.authenticate, auth_controller_1.giveConsent);
router.post('/refresh', auth_controller_1.refreshToken);
router.post('/logout', auth_middleware_1.authenticate, auth_controller_1.logout);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map