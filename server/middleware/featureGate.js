const { getUserEntitlement, hasFeatureAccess } = require("../services/entitlementService")

const requirePro = async (req, res, next) => {
  try {
    const userid = req.user?.userid
    if (!userid) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    const hasPro = await hasFeatureAccess(userid, "PRO")
    if (!hasPro) {
      return res.status(403).json({ message: "PRO subscription required" })
    }

    next()
  } catch (error) {
    return res.status(500).json({ message: "Feature access check failed" })
  }
}

const attachEntitlement = async (req, res, next) => {
  try {
    const userid = req.user?.userid
    if (userid) {
      req.entitlement = await getUserEntitlement(userid)
    }
    next()
  } catch {
    next()
  }
}

module.exports = {
  requirePro,
  attachEntitlement,
}
