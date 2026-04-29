"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const site_controller_1 = require("../controllers/site.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', site_controller_1.listSites);
router.post('/', site_controller_1.createSite);
router.get('/:id', site_controller_1.getSite);
router.put('/:id', site_controller_1.updateSite);
router.delete('/:id', site_controller_1.deleteSite);
exports.default = router;
//# sourceMappingURL=site.routes.js.map