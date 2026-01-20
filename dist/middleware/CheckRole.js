export const CheckRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.role || !allowedRoles.includes(req.role)) {
            return res.status(403).json({ message: "Forbidden: You do not have access to this resource." });
        }
        next();
    };
};
