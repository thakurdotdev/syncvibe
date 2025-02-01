const parseUserAgent = (req) => {
  const userAgent = req.get("User-Agent") || "";
  return [getBrowser(req, userAgent), getOS(userAgent)];
};

const getOS = (userAgent) => {
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Mac OS X/i.test(userAgent)) return "macOS";
  if (/iPhone/i.test(userAgent)) return "iOS";
  if (/Android/i.test(userAgent)) return "Android";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Unknown OS";
};

const getBrowser = (req, userAgent) => {
  if (
    req.get("X-Brave-Custom-Header") ||
    req.get("Sec-GPC") ||
    userAgent.includes("Brave")
  )
    return "Brave";
  if (/Firefox/i.test(userAgent)) return "Firefox";
  if (/Edge|Edg\//i.test(userAgent)) return "Edge";
  if (/OPR/i.test(userAgent)) return "Opera";
  if (/Safari/i.test(userAgent)) return "Safari";
  if (/MSIE|Trident/i.test(userAgent)) return "Internet Explorer";
  if (/Chrome/i.test(userAgent)) return "Chrome";
  return "Unknown browser";
};

module.exports = { parseUserAgent };
