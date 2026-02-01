const { Op } = require("sequelize")
const UserEntitlement = require("../models/payment/userEntitlementModel")
const Plan = require("../models/payment/planModel")

const getActiveEntitlement = async (userid, planCode) => {
  const plan = await Plan.findOne({ where: { code: planCode } })
  if (!plan) return null

  return UserEntitlement.findOne({
    where: {
      userid,
      planid: plan.planid,
      status: "ACTIVE",
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }],
    },
    include: [{ model: Plan, as: "plan" }],
  })
}

const createProEntitlement = async (userid, paymentid, transaction = null) => {
  const plan = await Plan.findOne({ where: { code: "PRO" } })
  if (!plan) {
    throw new Error("PRO plan not found")
  }

  const existing = await UserEntitlement.findOne({
    where: {
      userid,
      planid: plan.planid,
      status: "ACTIVE",
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }],
    },
    transaction,
    lock: transaction?.LOCK.UPDATE,
  })

  if (existing) {
    return { created: false, entitlement: existing }
  }

  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)

  const entitlement = await UserEntitlement.create(
    {
      userid,
      planid: plan.planid,
      paymentid,
      status: "ACTIVE",
      startsAt: now,
      expiresAt,
    },
    { transaction },
  )

  return { created: true, entitlement }
}

const hasFeatureAccess = async (userid, planCode) => {
  const entitlement = await getActiveEntitlement(userid, planCode)
  return !!entitlement
}

const getUserEntitlement = async (userid) => {
  return UserEntitlement.findOne({
    where: {
      userid,
      status: "ACTIVE",
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }],
    },
    include: [{ model: Plan, as: "plan" }],
    order: [["createdAt", "DESC"]],
  })
}

module.exports = {
  getActiveEntitlement,
  createProEntitlement,
  hasFeatureAccess,
  getUserEntitlement,
}
