"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const media_controller_1 = require("../controllers/media.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.post('/upload', media_controller_1.uploadMiddleware, media_controller_1.uploadMedia);
router.get('/mission/:missionId', media_controller_1.getMissionMedia);
router.get('/:id', media_controller_1.getMedia);
router.delete('/:id', media_controller_1.deleteMedia);
exports.default = router;
//# sourceMappingURL=media.routes.js.map