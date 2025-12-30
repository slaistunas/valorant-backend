const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  puuid: {
    type: String,
    required: true,
    unique: true
  },
  gameName: {
    type: String,
    required: true
  },
  tagLine: {
    type: String,
    required: true
  },
  region: {
    type: String,
    default: 'europe'
  },
  platformRegion: {
    type: String,
    default: 'eu'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  totalMatches: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const matchSchema = new mongoose.Schema({
  matchId: {
    type: String,
    required: true,
    unique: true
  },
  puuid: {
    type: String,
    required: true,
    index: true
  },
  map: String,
  mode: String,
  gameStartTime: Date,
  gameLengthMillis: Number,
  
  // Player performance
  kills: Number,
  deaths: Number,
  assists: Number,
  score: Number,
  agent: String,
  
  // Team result
  won: Boolean,
  roundsWon: Number,
  roundsLost: Number,
  teamColor: String,
  
  // Damage breakdown
  headshots: Number,
  bodyshots: Number,
  legshots: Number,
  
  // Full match data
  fullMatchData: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index for efficient queries
matchSchema.index({ puuid: 1, gameStartTime: -1 });

const statisticsSchema = new mongoose.Schema({
  puuid: {
    type: String,
    required: true,
    unique: true
  },
  totalKills: { type: Number, default: 0 },
  totalDeaths: { type: Number, default: 0 },
  totalAssists: { type: Number, default: 0 },
  totalMatches: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  
  // Calculated stats
  kd: { type: Number, default: 0 },
  winRate: { type: Number, default: 0 },
  headshotPercentage: { type: Number, default: 0 },
  
  // Agent stats
  agentStats: {
    type: Map,
    of: {
      matches: Number,
      wins: Number,
      kills: Number,
      deaths: Number,
      assists: Number,
      kd: Number,
      winRate: Number
    }
  },
  
  // Map stats
  mapStats: {
    type: Map,
    of: {
      matches: Number,
      wins: Number,
      kills: Number,
      deaths: Number,
      roundsWon: Number,
      roundsLost: Number,
      winRate: Number,
      kd: Number
    }
  },
  
  lastCalculated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const rankHistorySchema = new mongoose.Schema({
  puuid: {
    type: String,
    required: true,
    index: true
  },
  currentTier: Number,
  currentTierName: String,
  rankedRating: Number,
  leaderboardRank: Number,
  competitiveSeason: String,
  recordedAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);
const Match = mongoose.model('Match', matchSchema);
const Statistics = mongoose.model('Statistics', statisticsSchema);
const RankHistory = mongoose.model('RankHistory', rankHistorySchema);

module.exports = {
  User,
  Match,
  Statistics,
  RankHistory
};
