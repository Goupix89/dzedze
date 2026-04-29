"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
exports.requireConsent = requireConsent;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const AppError_1 = require("../utils/AppError");
const JWT_SECRET = process.env.JWT_SECRET;
// ─── Verify JWT ───────────────────────────────────────────────
function authenticate(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return next(new AppError_1.AppError('Token manquant ou invalide', 401));
    }
    const token = authHeader.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    }
    catch (err) {
        if (err.name === 'TokenExpiredError') {
            return next(new AppError_1.AppError('Token expiré, veuillez vous reconnecter', 401));
        }
        next(new AppError_1.AppError('Token invalide', 401));
    }
}
// ─── Role Guard ───────────────────────────────────────────────
function requireRole(...roles) {
    return (req, _res, next) => {
        const user = req.user;
        if (!user || !roles.includes(user.role)) {
            return next(new AppError_1.AppError(`Accès réservé aux rôles: ${roles.join(', ')}`, 403));
        }
        next();
    };
}
// ─── Consent Guard ────────────────────────────────────────────
async function requireConsent(req, _res, next) {
    const user = req.user;
    if (!user?.consentGiven) {
        return next(new AppError_1.AppError('Consentement RGPD requis avant utilisation', 403));
    }
    next();
}
//# sourceMappingURL=auth.middleware.js.map