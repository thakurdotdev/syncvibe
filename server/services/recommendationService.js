const sequelize = require("../utils/sequelize")
const { cache } = require("../utils/redis")

const CACHE_TTL_SECONDS = 3600
const POOL_SIZE = 50
const pendingUsers = new Set()

const shuffleArray = (array) => {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const getRecommendationsForUser = async (userId, limit = 12) => {
  const cacheKey = `recs:${userId}:pool`
  let pool = await cache.get(cacheKey)

  if (!pool || pool.length === 0) {
    pool = await computeRecommendations(userId, POOL_SIZE)
    await cache.set(cacheKey, pool, CACHE_TTL_SECONDS)
  }

  const shuffled = shuffleArray(pool)
  return shuffled.slice(0, limit)
}

const computeRecommendations = async (userId, limit) => {
  const profileQuery = `
    WITH user_stats AS (
      SELECT 
        s."artistNames",
        s.language,
        hs.mood,
        hs."timeOfDay",
        hs."playedCount",
        hs."completionRate",
        hs."likeStatus",
        hs."lastPlayedAt"
      FROM history_songs hs
      INNER JOIN songs s ON s.id = hs."songRefId"
      WHERE hs."userId" = :userId AND hs."songRefId" IS NOT NULL
    ),
    top_artists AS (
      SELECT unnest(string_to_array("artistNames", ',')) as artist, SUM("playedCount") as plays
      FROM user_stats
      GROUP BY 1
      ORDER BY plays DESC
      LIMIT 10
    ),
    top_languages AS (
      SELECT language, SUM("playedCount") as plays
      FROM user_stats WHERE language IS NOT NULL
      GROUP BY 1 ORDER BY plays DESC LIMIT 3
    ),
    current_hour_pref AS (
      SELECT EXTRACT(HOUR FROM NOW())::int as current_hour
    )
    SELECT 
      ARRAY(SELECT TRIM(artist) FROM top_artists) as top_artists,
      ARRAY(SELECT language FROM top_languages) as top_languages,
      (SELECT current_hour FROM current_hour_pref) as current_hour,
      (SELECT AVG("completionRate") FROM user_stats WHERE "completionRate" > 50) as avg_completion
  `

  const [profile] = await sequelize.query(profileQuery, {
    replacements: { userId },
    type: sequelize.QueryTypes.SELECT,
  })

  const topArtists = profile?.top_artists?.filter(Boolean) || []
  const topLanguages = profile?.top_languages?.filter(Boolean) || []
  const currentHour = profile?.current_hour || new Date().getHours()

  const artistPatterns = topArtists.length > 0 ? topArtists.map((a) => `%${a.trim()}%`) : null
  const hasArtists = artistPatterns && artistPatterns.length > 0
  const hasLanguages = topLanguages.length > 0

  const timeCategory =
    currentHour >= 5 && currentHour < 12
      ? "morning"
      : currentHour >= 12 && currentHour < 17
        ? "afternoon"
        : currentHour >= 17 && currentHour < 21
          ? "evening"
          : "night"

  const query = `
    SELECT "songData" FROM (
      SELECT DISTINCT ON (s.id) s."songData",
        (
          CASE WHEN hs."likeStatus" = true THEN 0.20 ELSE 0 END +
          ${hasArtists ? `CASE WHEN s."artistNames" ILIKE ANY(ARRAY[${artistPatterns.map((p) => sequelize.escape(p)).join(",")}]) THEN 0.20 ELSE 0 END` : "0"} +
          ${hasLanguages ? `CASE WHEN s.language = ANY(ARRAY[${topLanguages.map((l) => sequelize.escape(l)).join(",")}]) THEN 0.15 ELSE 0 END` : "0"} +
          (COALESCE(hs."completionRate", 0) / 100) * 0.15 +
          (LN(COALESCE(hs."playedCount", 1) + 1) / 5) * 0.15 +
          CASE WHEN hs."timeOfDay"::text = :timeCategory THEN 0.10 ELSE 0 END +
          EXP(-EXTRACT(DAY FROM NOW() - hs."lastPlayedAt") / 30) * 0.05
        ) as score,
        hs."playedCount"
      FROM history_songs hs
      INNER JOIN songs s ON s.id = hs."songRefId"
      WHERE hs."userId" = :userId AND hs."songRefId" IS NOT NULL
      ORDER BY s.id, score DESC
    ) ranked
    ORDER BY score DESC, "playedCount" DESC
    LIMIT :limit
  `

  const results = await sequelize.query(query, {
    replacements: { userId, limit, timeCategory },
    type: sequelize.QueryTypes.SELECT,
  })

  return results.map((r) => r.songData)
}

const getRecentlyPlayed = async (userId, limit = 15) => {
  const cacheKey = `recent:${userId}:${limit}`
  const cached = await cache.get(cacheKey)

  if (cached) {
    return cached
  }

  const query = `
    SELECT s."songData"
    FROM history_songs hs
    INNER JOIN songs s ON s.id = hs."songRefId"
    WHERE hs."userId" = :userId AND hs."songRefId" IS NOT NULL
    ORDER BY hs."lastPlayedAt" DESC
    LIMIT :limit
  `

  const results = await sequelize.query(query, {
    replacements: { userId, limit },
    type: sequelize.QueryTypes.SELECT,
  })

  const songs = results.map((r) => r.songData)
  await cache.set(cacheKey, songs, 60)

  return songs
}

const queueUserForRecalc = (userId) => {
  pendingUsers.add(userId)
}

const processPendingRecalculations = async () => {
  if (pendingUsers.size === 0) return

  const usersToProcess = [...pendingUsers]
  pendingUsers.clear()

  for (const userId of usersToProcess) {
    try {
      const pool = await computeRecommendations(userId, POOL_SIZE)
      await cache.set(`recs:${userId}:pool`, pool, CACHE_TTL_SECONDS)
    } catch (err) {
      console.error(`Failed to recalc recommendations for user ${userId}:`, err.message)
    }
  }

  console.log(`Recalculated recommendations for ${usersToProcess.length} users`)
}

let recalcInterval = null

const startBackgroundRecalc = (intervalMs = 60000) => {
  if (recalcInterval) return

  recalcInterval = setInterval(() => {
    processPendingRecalculations().catch(console.error)
  }, intervalMs)

  console.log(`Recommendation recalc job started (interval: ${intervalMs}ms)`)
}

const stopBackgroundRecalc = () => {
  if (recalcInterval) {
    clearInterval(recalcInterval)
    recalcInterval = null
    console.log("Recommendation recalc job stopped")
  }
}

const invalidateCache = async (userId) => {
  await cache.delPattern(`recs:${userId}:*`)
  await cache.delPattern(`recent:${userId}:*`)
}

module.exports = {
  getRecommendationsForUser,
  getRecentlyPlayed,
  queueUserForRecalc,
  startBackgroundRecalc,
  stopBackgroundRecalc,
  invalidateCache,
}
