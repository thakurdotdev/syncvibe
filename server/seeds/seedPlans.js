const sequelize = require("../utils/sequelize")
const Plan = require("../models/payment/planModel")

async function seedPlans() {
  try {
    await sequelize.authenticate()
    // await sequelize.sync({ alter: true })

    const plans = [
      {
        code: "FREE",
        name: "Free",
        maxGroupMembers: 2,
        realtimeChatEnabled: false,
        realtimeSyncEnabled: false,
      },
      {
        code: "PRO",
        name: "Pro",
        maxGroupMembers: 10,
        realtimeChatEnabled: true,
        realtimeSyncEnabled: true,
      },
    ]

    for (const plan of plans) {
      await Plan.findOrCreate({
        where: { code: plan.code },
        defaults: plan,
      })
    }

    console.log("✅ Plans seeded successfully")
    process.exit(0)
  } catch (err) {
    console.error("❌ Failed to seed plans", err)
    process.exit(1)
  }
}

seedPlans()
