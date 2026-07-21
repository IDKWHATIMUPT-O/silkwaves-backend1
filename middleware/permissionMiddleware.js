function requirePermission(section, level) {

  return (req, res, next) => {

    if (!req.admin) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.admin.role === "admin") {
      return next();
    }

    const allowed = req.admin.permissions?.[section]?.[level];

    if (!allowed) {
      return res.status(403).json({
        error: `You don't have ${level} access to ${section}`
      });
    }

    next();

  };

}

function requireAdminRole(req, res, next) {

  if (!req.admin) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.admin.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();

}

module.exports = { requirePermission, requireAdminRole };
