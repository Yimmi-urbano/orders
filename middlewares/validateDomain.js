// Middlewares/validateDomain.js

module.exports = (req, res, next) => {
    const domain = req.headers['domain'];
    if (!domain) {
        return res.status(400).json({ message: 'El encabezado "domain" es requerido' });
    }
    next();
};
