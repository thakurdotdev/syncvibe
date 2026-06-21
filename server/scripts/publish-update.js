const readline = require("readline")
const sequelize = require("../utils/sequelize")
const AppUpdate = require("../models/appUpdateModel")

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const askQuestion = (query) => {
  return new Promise((resolve) => rl.question(query, resolve))
}

async function main() {
  try {
    await sequelize.authenticate()
    await AppUpdate.sync({ alter: true })

    console.log("Publish a New App Update")
    const version = await askQuestion("App Version (e.g. 1.0.1): ")
    if (!version.trim()) {
      console.error("Version is required")
      process.exit(1)
    }

    const releaseNotes = await askQuestion("Release Notes / Features (text): ")
    const downloadUrl = await askQuestion("Download URL (link to APK): ")
    const criticalInput = await askQuestion("Is this a critical update? (y/N): ")
    const critical = criticalInput.toLowerCase().startsWith("y")

    const update = await AppUpdate.create({
      version: version.trim(),
      releaseNotes: releaseNotes.trim() || null,
      downloadUrl: downloadUrl.trim() || null,
      critical,
    })

    console.log("Successfully published app update:")
    console.log(JSON.stringify(update.get({ plain: true }), null, 2))
  } catch (error) {
    console.error("Failed to publish app update:", error)
  } finally {
    rl.close()
    await sequelize.close()
    process.exit(0)
  }
}

main()
