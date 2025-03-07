const { GoogleGenerativeAI } = require("@google/generative-ai");

class MusicAIAgent {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstructions:
        "You are a music recommendation system focusing on user engagement patterns and preferences.",
    });
    this.cache = new Map();
    this.CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  }

  async analyzeListeningPatterns(historyData) {
    const cacheKey = JSON.stringify(historyData);

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    try {
      const analysis = await this._performAnalysis(historyData);

      this.cache.set(cacheKey, {
        data: analysis,
        timestamp: Date.now(),
      });

      return analysis;
    } catch (error) {
      console.error("Error in analyzeListeningPatterns:", error);
      return this.getDefaultListeningAnalysis();
    }
  }

  async _performAnalysis(historyData) {
    const aggregatedData = this._aggregateHistoryData(historyData);
    const prompt = this._generateAnalysisPrompt(aggregatedData);

    const result = await this.model.generateContent(prompt);
    return this._parseAndValidateResponse(result.response.text());
  }

  _aggregateHistoryData(historyData) {
    return historyData.reduce(
      (acc, song) => {
        // Perform data aggregation logic here
        return {
          ...acc,
          languages: [...new Set([...acc.languages, song.songLanguage])],
          artists: [
            ...new Set([...acc.artists, ...song.artistNames.split(", ")]),
          ],
          timePatterns: {
            ...acc.timePatterns,
            [this._getTimeSlot(song.timeOfDay)]:
              (acc.timePatterns[this._getTimeSlot(song.timeOfDay)] || 0) + 1,
          },
          completionRates: [...acc.completionRates, song.completionRate],
          moods: [...acc.moods, song.mood].filter(Boolean),
        };
      },
      {
        languages: [],
        artists: [],
        timePatterns: {},
        completionRates: [],
        moods: [],
      },
    );
  }

  _getTimeSlot(hour) {
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 22) return "evening";
    return "night";
  }

  _generateAnalysisPrompt(aggregatedData) {
    return `
      Analyze this listening pattern data and provide insights:
      ${JSON.stringify(aggregatedData, null, 2)}

      Focus on:
      1. Language preferences and their correlation with time slots
      2. Artist popularity and genre clustering
      3. Completion rate patterns
      4. Mood transitions throughout the day
      5. Device-specific patterns

      Return a JSON with:
      {
        "preferredLanguages": [],
        "preferredArtists": [],
        "timePatterns": {},
        "completionInsights": "",
        "moodRecommendations": [],
        "deviceSpecificTrends": {}
      }
    `;
  }

  _parseAndValidateResponse(response) {
    try {
      const parsed = JSON.parse(response.replace(/```json|```/g, "").trim());
      return this._validateAnalysis(parsed);
    } catch (error) {
      console.error("Error parsing AI response:", error);
      return this.getDefaultListeningAnalysis();
    }
  }

  _validateAnalysis(analysis) {
    const requiredFields = [
      "preferredLanguages",
      "preferredArtists",
      "timePatterns",
      "completionInsights",
      "moodRecommendations",
    ];

    const isValid = requiredFields.every((field) => field in analysis);
    return isValid ? analysis : this.getDefaultListeningAnalysis();
  }

  getDefaultListeningAnalysis() {
    return {
      preferredLanguages: [],
      preferredArtists: [],
      timePatterns: {},
      completionInsights: "Unable to analyze patterns",
      moodRecommendations: [],
      deviceSpecificTrends: {},
    };
  }
}

module.exports = MusicAIAgent;
