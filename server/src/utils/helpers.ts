import type { Request } from 'express';
import type { IncomingHttpHeaders } from 'node:http';

type HeaderSource =
  | Request
  | {
      headers?: IncomingHttpHeaders;
      get?: (name: string) => string | undefined;
      ip?: string;
      socket?: { remoteAddress?: string };
    };

const getHeader = (req: HeaderSource, name: string): string | undefined => {
  const fromHeaders = req.headers?.[name];
  if (typeof fromHeaders === 'string') return fromHeaders;
  if (typeof req.get === 'function') return req.get(name);
  return undefined;
};

export const getClientIp = (req: HeaderSource): string => {
  const cfIp = getHeader(req, 'cf-connecting-ip');
  if (cfIp?.trim()) return cfIp.trim();

  const forwarded = getHeader(req, 'x-forwarded-for');
  if (forwarded?.trim()) {
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = getHeader(req, 'x-real-ip');
  if (realIp?.trim()) return realIp.trim();

  if (req.ip) return req.ip;
  if (req.socket?.remoteAddress) return req.socket.remoteAddress;

  return 'Unknown IP';
};

export const getClientLocation = (req: HeaderSource): string => {
  const cityHeader = getHeader(req, 'cf-ipcity');
  const regionHeader = getHeader(req, 'cf-region') ?? getHeader(req, 'cf-region-code');
  const countryHeader = getHeader(req, 'cf-ipcountry');

  const cfParts = [cityHeader, regionHeader, countryHeader]
    .filter(
      (val): val is string =>
        val !== undefined &&
        val !== null &&
        typeof val === 'string' &&
        val.trim().length > 0 &&
        val.trim().toLowerCase() !== 'undefined' &&
        val.trim().toLowerCase() !== 'null'
    )
    .map((val) => {
      try {
        return decodeURIComponent(val.trim());
      } catch {
        return val.trim();
      }
    });

  if (cfParts.length > 0) {
    return cfParts.join(', ');
  }

  return 'Unknown';
};

const getBrowser = (req: HeaderSource, userAgent: string): string => {
  const secChUa = getHeader(req, 'sec-ch-ua') ?? '';

  if (
    /Brave/i.test(secChUa) ||
    req.headers?.['x-brave-custom-header'] ||
    getHeader(req, 'sec-gpc') ||
    userAgent.includes('Brave')
  ) {
    return 'Brave';
  }
  if (/Opera|OPR/i.test(secChUa) || /OPR|Opera/i.test(userAgent)) return 'Opera';
  if (/Microsoft Edge|Edg/i.test(secChUa) || /Edge|Edg\//i.test(userAgent)) return 'Edge';
  if (/Vivaldi/i.test(secChUa) || /Vivaldi/i.test(userAgent)) return 'Vivaldi';
  if (/Google Chrome/i.test(secChUa)) return 'Chrome';
  if (/Firefox/i.test(userAgent)) return 'Firefox';
  if (/Safari/i.test(userAgent) && !/Chrome|Android/i.test(userAgent)) return 'Safari';
  if (/MSIE|Trident/i.test(userAgent)) return 'Internet Explorer';
  if (/Chrome/i.test(userAgent) || /Chromium/i.test(secChUa)) return 'Chrome';

  return 'Unknown browser';
};

const getOS = (req: HeaderSource, userAgent: string): string => {
  const platformHeader = getHeader(req, 'sec-ch-ua-platform') ?? '';
  const platform = platformHeader.replace(/"/g, '').trim();

  if (/Windows/i.test(platform) || /Windows/i.test(userAgent)) return 'Windows';
  if (/macOS/i.test(platform) || /Mac OS X|Macintosh/i.test(userAgent)) return 'macOS';
  if (/iOS/i.test(platform) || /iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  if (/Android/i.test(platform) || /Android/i.test(userAgent)) return 'Android';
  if (/Linux/i.test(platform) || /Linux/i.test(userAgent)) return 'Linux';
  if (/Chrome OS/i.test(platform)) return 'ChromeOS';

  return 'Unknown OS';
};

export const parseUserAgent = (req: HeaderSource): [string, string] => {
  const userAgent =
    (typeof req.get === 'function' ? req.get('User-Agent') : req.headers?.['user-agent']) ?? '';
  return [getBrowser(req, userAgent), getOS(req, userAgent)];
};
