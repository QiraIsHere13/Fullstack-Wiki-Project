const jwt = require("jsonwebtoken");

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ ok: false, error: "Missing Bearer token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, username, email }
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Invalid/expired token" });
  }
}

module.exports = { authRequired };
