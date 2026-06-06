const sequelize = require("./utils/sequelize")

async function runMigration() {
  try {
    await sequelize.query(`
      ALTER TABLE "chatmessage" 
      ADD COLUMN IF NOT EXISTS "messagetype" VARCHAR(255) NOT NULL DEFAULT 'text';
    `)
    console.log("Migration completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("Migration failed:", error)
    process.exit(1)
  }
}

runMigration()
