const getClientIp = (req) => {
  const cfIp = req.headers?.["cf-connecting-ip"] || (typeof req.get === "function" && req.get("cf-connecting-ip"))
  if (cfIp && typeof cfIp === "string" && cfIp.trim()) {
    return cfIp.trim()
  }

  const forwarded = req.headers?.["x-forwarded-for"] || (typeof req.get === "function" && req.get("x-forwarded-for"))
  if (forwarded && typeof forwarded === "string" && forwarded.trim()) {
    const firstIp = forwarded.split(",")[0].trim()
    if (firstIp) return firstIp
  }

  const realIp = req.headers?.["x-real-ip"] || (typeof req.get === "function" && req.get("x-real-ip"))
  if (realIp && typeof realIp === "string" && realIp.trim()) {
    return realIp.trim()
  }

  if (req.ip) return req.ip
  if (req.socket?.remoteAddress) return req.socket.remoteAddress

  return "Unknown IP"
}

const getClientLocation = (req) => {
  const cityHeader = req.headers?.["cf-ipcity"] || (typeof req.get === "function" && req.get("cf-ipcity"))
  const regionHeader =
    req.headers?.["cf-region"] ||
    req.headers?.["cf-region-code"] ||
    (typeof req.get === "function" && req.get("cf-region"))
  const countryHeader = req.headers?.["cf-ipcountry"] || (typeof req.get === "function" && req.get("cf-ipcountry"))

  const cfParts = [cityHeader, regionHeader, countryHeader]
    .filter(
      (val) =>
        val !== undefined &&
        val !== null &&
        typeof val === "string" &&
        val.trim().length > 0 &&
        val.trim().toLowerCase() !== "undefined" &&
        val.trim().toLowerCase() !== "null",
    )
    .map((val) => {
      try {
        return decodeURIComponent(val.trim())
      } catch {
        return val.trim()
      }
    })

  if (cfParts.length > 0) {
    return cfParts.join(", ")
  }

  return "Unknown"
}

const getBrowser = (req, userAgent) => {
  const secChUa = req.headers?.["sec-ch-ua"] || (typeof req.get === "function" && req.get("sec-ch-ua")) || ""

  if (/Brave/i.test(secChUa) || req.headers?.["x-brave-custom-header"] || (typeof req.get === "function" && req.get("sec-gpc")) || userAgent.includes("Brave")) {
    return "Brave"
  }
  if (/Opera|OPR/i.test(secChUa) || /OPR|Opera/i.test(userAgent)) return "Opera"
  if (/Microsoft Edge|Edg/i.test(secChUa) || /Edge|Edg\//i.test(userAgent)) return "Edge"
  if (/Vivaldi/i.test(secChUa) || /Vivaldi/i.test(userAgent)) return "Vivaldi"
  if (/Google Chrome/i.test(secChUa)) return "Chrome"
  if (/Firefox/i.test(userAgent)) return "Firefox"
  if (/Safari/i.test(userAgent) && !/Chrome|Android/i.test(userAgent)) return "Safari"
  if (/MSIE|Trident/i.test(userAgent)) return "Internet Explorer"
  if (/Chrome/i.test(userAgent) || /Chromium/i.test(secChUa)) return "Chrome"

  return "Unknown browser"
}

const getOS = (req, userAgent) => {
  const platformHeader = req.headers?.["sec-ch-ua-platform"] || (typeof req.get === "function" && req.get("sec-ch-ua-platform")) || ""
  const platform = platformHeader.replace(/"/g, "").trim()

  if (/Windows/i.test(platform) || /Windows/i.test(userAgent)) return "Windows"
  if (/macOS/i.test(platform) || /Mac OS X|Macintosh/i.test(userAgent)) return "macOS"
  if (/iOS/i.test(platform) || /iPhone|iPad|iPod/i.test(userAgent)) return "iOS"
  if (/Android/i.test(platform) || /Android/i.test(userAgent)) return "Android"
  if (/Linux/i.test(platform) || /Linux/i.test(userAgent)) return "Linux"
  if (/Chrome OS/i.test(platform)) return "ChromeOS"

  return "Unknown OS"
}

const parseUserAgent = (req) => {
  const userAgent = (typeof req.get === "function" ? req.get("User-Agent") : req.headers?.["user-agent"]) || ""
  return [getBrowser(req, userAgent), getOS(req, userAgent)]
}

module.exports = { parseUserAgent, getClientIp, getClientLocation }


