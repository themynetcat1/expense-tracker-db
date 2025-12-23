module.exports = function requireAdmin(req, res, next) {
    if (!req.user?.isAdmin) {
        return res.status(403).send('Forbidden: Admin access required.');
    }
    return next();
};
