module.exports = (req, res, next) => {
  const key = req.headers["x-tally-bridge-key"];

  if (!key || key !== process.env.TALLY_BRIDGE_API_KEY) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  next();
};
