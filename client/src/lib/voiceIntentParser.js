const VOICE_COMMANDS = [
  {
    action: "next",
    keywords: ["next song", "play next", "skip song", "skip", "next", "forward"],
    feedback: "Playing next song",
    priority: 10,
  },
  {
    action: "previous",
    keywords: [
      "previous song",
      "play previous",
      "last song",
      "go back",
      "back",
      "previous",
      "prev",
    ],
    feedback: "Playing previous song",
    priority: 10,
  },
  {
    action: "shuffle",
    keywords: ["toggle shuffle", "shuffle mode", "shuffle on", "shuffle off", "shuffle", "random"],
    feedback: "Shuffle toggled",
    priority: 8,
  },
  {
    action: "repeat",
    keywords: [
      "toggle repeat",
      "repeat mode",
      "repeat one",
      "repeat all",
      "repeat off",
      "repeat",
      "loop",
    ],
    feedback: "Repeat toggled",
    priority: 8,
  },
  {
    action: "clearQueue",
    keywords: ["clear queue", "clear the queue", "empty queue", "remove all songs"],
    feedback: "Queue cleared",
    priority: 9,
  },
  {
    action: "volumeUp",
    keywords: ["volume up", "turn up", "increase volume", "louder", "more volume"],
    feedback: "Volume increased",
    priority: 7,
  },
  {
    action: "volumeDown",
    keywords: [
      "volume down",
      "turn down",
      "decrease volume",
      "quieter",
      "lower volume",
      "less volume",
    ],
    feedback: "Volume decreased",
    priority: 7,
  },
  {
    action: "mute",
    keywords: ["mute", "silence", "no sound"],
    feedback: "Muted",
    priority: 7,
  },
  {
    action: "pause",
    keywords: ["pause music", "pause song", "stop music", "stop playing", "pause", "stop", "hold"],
    feedback: "Paused",
    priority: 5,
  },
  {
    action: "play",
    keywords: [
      "play music",
      "play song",
      "resume music",
      "resume playing",
      "start playing",
      "play",
      "resume",
      "start",
      "continue",
    ],
    feedback: "Playing",
    priority: 3,
  },
]

const SEARCH_PREFIXES = ["play the song", "search for", "search", "find song", "find"]

const IGNORED_QUERIES = ["song", "songs", "music", "the", "a", "some", "something", "anything"]

const extractSearchQuery = (text) => {
  const normalizedText = text.toLowerCase().trim()

  for (const prefix of SEARCH_PREFIXES) {
    if (normalizedText.startsWith(prefix)) {
      const query = normalizedText.slice(prefix.length).trim()
      if (query.length >= 2 && !IGNORED_QUERIES.includes(query)) {
        return query
      }
    }
  }

  return null
}

export const parseVoiceIntent = (transcript) => {
  if (!transcript) return null

  const normalizedText = transcript.toLowerCase().trim()

  let bestMatch = null
  let bestScore = -1

  for (const command of VOICE_COMMANDS) {
    for (const keyword of command.keywords) {
      if (normalizedText.includes(keyword)) {
        const score = keyword.length * 10 + command.priority
        if (score > bestScore) {
          bestScore = score
          bestMatch = {
            action: command.action,
            feedback: command.feedback,
            transcript: normalizedText,
            matchedKeyword: keyword,
          }
        }
      }
    }
  }

  if (bestMatch) return bestMatch

  const searchQuery = extractSearchQuery(normalizedText)
  if (searchQuery) {
    return {
      action: "search",
      feedback: `Searching for "${searchQuery}"`,
      transcript: normalizedText,
      query: searchQuery,
    }
  }

  return {
    action: "unknown",
    feedback: "Command not recognized",
    transcript: normalizedText,
  }
}

export const getSupportedCommands = () => {
  return [
    ...VOICE_COMMANDS.map((cmd) => ({
      action: cmd.action,
      keywords: cmd.keywords,
      feedback: cmd.feedback,
    })),
    {
      action: "search",
      keywords: SEARCH_PREFIXES,
      feedback: "Search and play a song",
    },
  ]
}
