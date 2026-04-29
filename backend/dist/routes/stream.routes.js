"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stream_controller_1 = require("../controllers/stream.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.post('/request', stream_controller_1.requestStream);
router.put('/:sessionId/respond', stream_controller_1.respondToStream);
router.delete('/:sessionId', stream_controller_1.stopStream);
router.get('/:sessionId', stream_controller_1.getStreamSession);
exports.default = router;
//# sourceMappingURL=stream.routes.js.map