const crypto = require("crypto")

const algorithm = "aes-256-cbc"

const encrypt = (text) => {
  const cipher = crypto.createCipheriv(
    algorithm,
    process.env.ENCRYPTION_KEY,
    process.env.ENCRYPTION_IV,
  )
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  return encrypted
}

const decrypt = (encryptedText) => {
  const decipher = crypto.createDecipheriv(
    algorithm,
    process.env.ENCRYPTION_KEY,
    process.env.ENCRYPTION_IV,
  )
  let decrypted = decipher.update(encryptedText, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}

module.exports = {
  encrypt,
  decrypt,
}
