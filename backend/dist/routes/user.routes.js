"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_controller_1 = require("../controllers/user.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/me', user_controller_1.getMe);
router.get('/agents/available', user_controller_1.listAvailableAgents);
router.get('/', user_controller_1.listUsers);
router.get('/:id', user_controller_1.getUser);
router.put('/:id', user_controller_1.updateUser);
router.put('/:id/password', user_controller_1.changePassword);
router.delete('/:id', user_controller_1.deleteUser);
exports.default = router;
//# sourceMappingURL=user.routes.js.map