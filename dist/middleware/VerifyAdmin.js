export const VerifyAdmin = (req, res, next) => {
    if (req.role !== "Admin") {
        return res.status(401).send("Not authorized");
    }
    next();
};
