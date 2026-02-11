const express = require('express');
const router = express.Router();
const RiotAPIService = require('../services/riotAPI');
const { User, Match, Statistics, RankHistory } = require('../models');

const riotAPI = new RiotAPIService(process.env.RIOT_API_KEY);

// Get player profile by Riot ID
router.get('/player/:gameName/:tagLine', async (req, res) => {
  try {
    const { gameName, tagLine } = req.params;
    const { region = 'europe', platformRegion = 'eu' } = req.query;

    console.log(`Fetching profile for ${gameName}#${tagLine}`);

    const profile = await riotAPI.getPlayerProfile(gameName, tagLine, region, platformRegion);

    // Save/update user in database
    await User.findOneAndUpdate(
      { puuid: profile.account.puuid },
      {
        puuid: profile.account.puuid,
        gameName: profile.account.gameName,
        tagLine: profile.account.tagLine,
        region,
        platformRegion,
        lastUpdated: new Date(),
        totalMatches: profile.statistics.totalMatches
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching player profile:', error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.status?.message || error.message
    });
  }
});

// Get match history
router.get('/matches/:puuid', async (req, res) => {
  try {
    const { puuid } = req.params;
    const { region = 'europe', count = 20 } = req.query;

    const matches = await riotAPI.getRecentMatchesWithDetails(puuid, region, parseInt(count));

    res.json({
      success: true,
      data: matches
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.status?.message || error.message
    });
  }
});

// Get specific match details
router.get('/match/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { region = 'europe' } = req.query;

    const match = await riotAPI.getMatchDetails(matchId, region);

    res.json({
      success: true,
      data: match
    });
  } catch (error) {
    console.error('Error fetching match:', error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.status?.message || error.message
    });
  }
});

// Get player statistics
router.get('/stats/:puuid', async (req, res) => {
  try {
    const { puuid } = req.params;
    const { region = 'europe', count = 20 } = req.query;

    const matches = await riotAPI.getRecentMatchesWithDetails(puuid, region, parseInt(count));
    const stats = riotAPI.calculatePlayerStats(matches, puuid);

    // Save statistics to database
    await Statistics.findOneAndUpdate(
      { puuid },
      {
        puuid,
        ...stats,
        lastCalculated: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error calculating stats:', error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.status?.message || error.message
    });
  }
});

// Get player MMR/Rank
router.get('/rank/:puuid', async (req, res) => {
  try {
    const { puuid } = req.params;
    const { platformRegion = 'eu' } = req.query;

    const mmr = await riotAPI.getPlayerMMR(puuid, platformRegion);

    // Save rank history
    if (mmr && mmr.currenttier) {
      await RankHistory.create({
        puuid,
        currentTier: mmr.currenttier,
        currentTierName: mmr.currenttierpatched,
        rankedRating: mmr.ranking_in_tier,
        leaderboardRank: mmr.leaderboard_rank,
        competitiveSeason: mmr.current_season,
        recordedAt: new Date()
      });
    }

    res.json({
      success: true,
      data: mmr
    });
  } catch (error) {
    console.error('Error fetching rank:', error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.status?.message || error.message
    });
  }
});

// Get rank history
router.get('/rank-history/:puuid', async (req, res) => {
  try {
    const { puuid } = req.params;
    const { limit = 50 } = req.query;

    const history = await RankHistory.find({ puuid })
      .sort({ recordedAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching rank history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get game content (maps, agents, etc.)
router.get('/content', async (req, res) => {
  try {
    const { region = 'eu' } = req.query;
    const content = await riotAPI.getContent(region);

    res.json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.status?.message || error.message
    });
  }
});

// Search player
router.get('/search', async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Search name is required'
      });
    }

    const users = await User.find({
      $or: [
        { gameName: new RegExp(name, 'i') },
        { tagLine: new RegExp(name, 'i') }
      ]
    }).limit(10);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error searching players:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { region = 'eu', size = 200, startIndex = 0 } = req.query;
    
    console.log(`Fetching leaderboard for region: ${region}`);

    const leaderboard = await riotAPI.getLeaderboardCurrent(region, parseInt(size), parseInt(startIndex));

    res.json({
      success: true,
      data: leaderboard,
      region: region
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.status?.message || error.message
    });
  }
});

module.exports = router;
