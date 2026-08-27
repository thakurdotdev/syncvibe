import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

interface HistoryEntry {
  songLanguage: string;
  artistNames: string;
  timeOfDay: number;
  completionRate: number;
  mood?: string;
}

interface AggregatedData {
  languages: string[];
  artists: string[];
  timePatterns: Record<string, number>;
  completionRates: number[];
  moods: string[];
}

interface ListeningAnalysis {
  preferredLanguages: string[];
  preferredArtists: string[];
  timePatterns: Record<string, number>;
  completionInsights: string;
  moodRecommendations: string[];
  deviceSpecificTrends: Record<string, unknown>;
}

interface CacheEntry {
  data: ListeningAnalysis;
  timestamp: number;
}

export class MusicAIAgent {
  private model: GenerativeModel;
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 30 * 60 * 1000;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction:
        'You are a music recommendation system focusing on user engagement patterns and preferences.',
    });
  }

  async analyzeListeningPatterns(historyData: HistoryEntry[]): Promise<ListeningAnalysis> {
    const cacheKey = JSON.stringify(historyData);

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL) return cached.data;
    }

    try {
      const analysis = await this.performAnalysis(historyData);
      this.cache.set(cacheKey, { data: analysis, timestamp: Date.now() });
      return analysis;
    } catch (error) {
      console.error('Error in analyzeListeningPatterns:', error);
      return this.getDefaultListeningAnalysis();
    }
  }

  private async performAnalysis(historyData: HistoryEntry[]): Promise<ListeningAnalysis> {
    const aggregatedData = this.aggregateHistoryData(historyData);
    const prompt = this.generateAnalysisPrompt(aggregatedData);
    const result = await this.model.generateContent(prompt);
    return this.parseAndValidateResponse(result.response.text());
  }

  private aggregateHistoryData(historyData: HistoryEntry[]): AggregatedData {
    return historyData.reduce<AggregatedData>(
      (acc, song) => ({
        languages: [...new Set([...acc.languages, song.songLanguage])],
        artists: [...new Set([...acc.artists, ...song.artistNames.split(', ')])],
        timePatterns: {
          ...acc.timePatterns,
          [this.getTimeSlot(song.timeOfDay)]:
            (acc.timePatterns[this.getTimeSlot(song.timeOfDay)] || 0) + 1,
        },
        completionRates: [...acc.completionRates, song.completionRate],
        moods: [...acc.moods, song.mood].filter((m): m is string => !!m),
      }),
      { languages: [], artists: [], timePatterns: {}, completionRates: [], moods: [] }
    );
  }

  private getTimeSlot(hour: number): string {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  private generateAnalysisPrompt(aggregatedData: AggregatedData): string {
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

  private parseAndValidateResponse(response: string): ListeningAnalysis {
    try {
      const parsed = JSON.parse(response.replace(/```json|```/g, '').trim()) as ListeningAnalysis;
      return this.validateAnalysis(parsed);
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return this.getDefaultListeningAnalysis();
    }
  }

  private validateAnalysis(analysis: ListeningAnalysis): ListeningAnalysis {
    const requiredFields: Array<keyof ListeningAnalysis> = [
      'preferredLanguages',
      'preferredArtists',
      'timePatterns',
      'completionInsights',
      'moodRecommendations',
    ];
    const isValid = requiredFields.every((field) => field in analysis);
    return isValid ? analysis : this.getDefaultListeningAnalysis();
  }

  getDefaultListeningAnalysis(): ListeningAnalysis {
    return {
      preferredLanguages: [],
      preferredArtists: [],
      timePatterns: {},
      completionInsights: 'Unable to analyze patterns',
      moodRecommendations: [],
      deviceSpecificTrends: {},
    };
  }
}
