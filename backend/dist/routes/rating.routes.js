"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rating_controller_1 = require("../controllers/rating.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.post('/missions/:id/rating', rating_controller_1.submitMissionRating);
router.get('/agents/:id/ratings', rating_controller_1.getAgentRatings);
exports.default = router;
//# sourceMappingURL=rating.routes.js.map