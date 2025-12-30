const axios = require('axios');
const NodeCache = require('node-cache');

// Cache for 5 minutes
const cache = new NodeCache({ stdTTL: 300 });

class RiotAPIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.regions = {
      europe: 'https://europe.api.riotgames.com',
      americas: 'https://americas.api.riotgames.com',
      asia: 'https://asia.api.riotgames.com',
      ap: 'https://ap.api.riotgames.com'
    };
    this.platformUrls = {
      eu: 'https://eu.api.riotgames.com',
      na: 'https://na.api.riotgames.com',
      ap: 'https://ap.api.riotgames.com',
      kr: 'https://kr.api.riotgames.com'
    };
  }

  // Helper function to make API requests with caching
  async makeRequest(url, cacheKey = null) {
    if (cacheKey) {
      const cached = cache.get(cacheKey);
      if (cached) return cached;
    }

    try {
      const response = await axios.get(url, {
        headers: {
          'X-Riot-Token': this.apiKey
        }
      });

      if (cacheKey) {
        cache.set(cacheKey, response.data);
      }

      return response.data;
    } catch (error) {
      console.error('Riot API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get account by Riot ID (name#tag)
  async getAccountByRiotId(gameName, tagLine, region = 'europe') {
    const url = `${this.regions[region]}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    return await this.makeRequest(url, `account:${gameName}:${tagLine}`);
  }

  // Get account by PUUID
  async getAccountByPuuid(puuid, region = 'europe') {
    const url = `${this.regions[region]}/riot/account/v1/accounts/by-puuid/${puuid}`;
    return await this.makeRequest(url, `account:puuid:${puuid}`);
  }

  // Get player MMR (Rank) - Official Riot API doesn't have this endpoint
  // This is only available through unofficial APIs
  async getPlayerMMR(puuid, region = 'eu') {
    // Official Riot API doesn't provide MMR/Rank data directly
    // Return null for now
    return null;
  }

  // Get match history (last X matches) - Official Riot API
  async getMatchHistory(puuid, region = 'europe', count = 20) {
    const url = `${this.regions[region]}/val/match/v1/matchlists/by-puuid/${puuid}`;
    return await this.makeRequest(url, `matches:${puuid}:${count}`);
  }

  // Get detailed match data
  async getMatchDetails(matchId, region = 'europe') {
    const url = `${this.regions[region]}/val/match/v1/matches/${matchId}`;
    return await this.makeRequest(url, `match:${matchId}`);
  }

  // Get recent matches with full details
  async getRecentMatchesWithDetails(puuid, region = 'europe', count = 10) {
    try {
      const matchHistory = await this.getMatchHistory(puuid, region, count);
      
      const matchDetails = await Promise.all(
        matchHistory.history.map(match => 
          this.getMatchDetails(match.matchId, region)
        )
      );

      return matchDetails;
    } catch (error) {
      console.error('Error fetching match details:', error);
      throw error;
    }
  }

  // Get content (maps, agents, weapons, etc.)
  async getContent(region = 'eu') {
    const url = `${this.platformUrls[region]}/val/content/v1/contents`;
    return await this.makeRequest(url, 'content');
  }

  // Get competitive updates
  async getCompetitiveUpdates(puuid, region = 'europe', queue = 'competitive', start = 0, end = 20) {
    const url = `${this.regions[region]}/val/match/v1/matchlists/by-puuid/${puuid}?queue=${queue}&start=${start}&end=${end}`;
    return await this.makeRequest(url, `competitive:${puuid}:${start}:${end}`);
  }

  // Calculate player statistics from matches
  calculatePlayerStats(matches, puuid) {
    const stats = {
      totalMatches: matches.length,
      wins: 0,
      losses: 0,
      draws: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalAssists: 0,
      totalScore: 0,
      totalRounds: 0,
      roundsWon: 0,
      roundsLost: 0,
      headshotPercentage: 0,
      totalHeadshots: 0,
      totalBodyshots: 0,
      totalLegshots: 0,
      agents: {},
      weapons: {},
      maps: {},
      recentMatches: []
    };

    matches.forEach(match => {
      const player = match.players.all_players.find(p => p.puuid === puuid);
      if (!player) return;

      // Basic stats
      stats.totalKills += player.stats.kills;
      stats.totalDeaths += player.stats.deaths;
      stats.totalAssists += player.stats.assists;
      stats.totalScore += player.stats.score;

      // Rounds
      const teams = match.teams;
      const playerTeam = player.team.toLowerCase();
      const team = teams[playerTeam];
      
      if (team) {
        stats.roundsWon += team.rounds_won;
        stats.roundsLost += team.rounds_lost;
        stats.totalRounds += (team.rounds_won + team.rounds_lost);

        if (team.has_won) {
          stats.wins++;
        } else if (teams.red?.rounds_won === teams.blue?.rounds_won) {
          stats.draws++;
        } else {
          stats.losses++;
        }
      }

      // Damage stats for headshot percentage
      if (player.damage_made) {
        stats.totalHeadshots += player.damage_made.headshots || 0;
        stats.totalBodyshots += player.damage_made.bodyshots || 0;
        stats.totalLegshots += player.damage_made.legshots || 0;
      }

      // Agent stats
      const agentName = player.character;
      if (!stats.agents[agentName]) {
        stats.agents[agentName] = {
          matches: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          kd: 0,
          winRate: 0
        };
      }
      stats.agents[agentName].matches++;
      stats.agents[agentName].kills += player.stats.kills;
      stats.agents[agentName].deaths += player.stats.deaths;
      stats.agents[agentName].assists += player.stats.assists;
      if (team?.has_won) stats.agents[agentName].wins++;

      // Map stats
      const mapName = match.metadata.map;
      if (!stats.maps[mapName]) {
        stats.maps[mapName] = {
          matches: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          roundsWon: 0,
          roundsLost: 0
        };
      }
      stats.maps[mapName].matches++;
      stats.maps[mapName].kills += player.stats.kills;
      stats.maps[mapName].deaths += player.stats.deaths;
      if (team) {
        stats.maps[mapName].roundsWon += team.rounds_won;
        stats.maps[mapName].roundsLost += team.rounds_lost;
        if (team.has_won) stats.maps[mapName].wins++;
      }

      // Recent match summary
      stats.recentMatches.push({
        matchId: match.metadata.matchid,
        map: mapName,
        mode: match.metadata.mode,
        date: new Date(match.metadata.game_start * 1000),
        kills: player.stats.kills,
        deaths: player.stats.deaths,
        assists: player.stats.assists,
        score: player.stats.score,
        agent: agentName,
        won: team?.has_won || false,
        roundsWon: team?.rounds_won || 0,
        roundsLost: team?.rounds_lost || 0
      });
    });

    // Calculate derived stats
    stats.kd = stats.totalDeaths > 0 ? (stats.totalKills / stats.totalDeaths).toFixed(2) : stats.totalKills;
    stats.winRate = stats.totalMatches > 0 ? ((stats.wins / stats.totalMatches) * 100).toFixed(1) : 0;
    
    const totalShots = stats.totalHeadshots + stats.totalBodyshots + stats.totalLegshots;
    stats.headshotPercentage = totalShots > 0 ? ((stats.totalHeadshots / totalShots) * 100).toFixed(1) : 0;
    
    stats.averageKills = stats.totalMatches > 0 ? (stats.totalKills / stats.totalMatches).toFixed(1) : 0;
    stats.averageDeaths = stats.totalMatches > 0 ? (stats.totalDeaths / stats.totalMatches).toFixed(1) : 0;
    stats.averageAssists = stats.totalMatches > 0 ? (stats.totalAssists / stats.totalMatches).toFixed(1) : 0;
    stats.averageScore = stats.totalMatches > 0 ? Math.round(stats.totalScore / stats.totalMatches) : 0;

    // Calculate agent-specific derived stats
    Object.keys(stats.agents).forEach(agent => {
      const agentStats = stats.agents[agent];
      agentStats.kd = agentStats.deaths > 0 ? (agentStats.kills / agentStats.deaths).toFixed(2) : agentStats.kills;
      agentStats.winRate = agentStats.matches > 0 ? ((agentStats.wins / agentStats.matches) * 100).toFixed(1) : 0;
    });

    // Calculate map-specific derived stats
    Object.keys(stats.maps).forEach(map => {
      const mapStats = stats.maps[map];
      mapStats.winRate = mapStats.matches > 0 ? ((mapStats.wins / mapStats.matches) * 100).toFixed(1) : 0;
      mapStats.kd = mapStats.deaths > 0 ? (mapStats.kills / mapStats.deaths).toFixed(2) : mapStats.kills;
      mapStats.roundWinRate = (mapStats.roundsWon + mapStats.roundsLost) > 0 
        ? ((mapStats.roundsWon / (mapStats.roundsWon + mapStats.roundsLost)) * 100).toFixed(1) 
        : 0;
    });

    return stats;
  }

  // Get comprehensive player profile
  async getPlayerProfile(gameName, tagLine, region = 'europe', platformRegion = 'eu') {
    try {
      // Get account info
      const account = await this.getAccountByRiotId(gameName, tagLine, region);
      
      console.log('Account found:', account);

      // Try to get match history
      let matches = [];
      try {
        const matchHistory = await this.getMatchHistory(account.puuid, region, 5);
        console.log('Match history response:', matchHistory);
        
        if (matchHistory && matchHistory.history && matchHistory.history.length > 0) {
          // Get details for each match
          const matchIds = matchHistory.history.slice(0, 5).map(m => m.matchId);
          matches = await Promise.all(
            matchIds.map(matchId => this.getMatchDetails(matchId, region).catch(e => null))
          );
          matches = matches.filter(m => m !== null);
        }
      } catch (error) {
        console.log('Match history not available:', error.message);
      }

      // Calculate statistics only if we have matches
      const stats = matches.length > 0 
        ? this.calculatePlayerStats(matches, account.puuid)
        : {
            totalMatches: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            totalKills: 0,
            totalDeaths: 0,
            totalAssists: 0,
            kd: 0,
            winRate: 0,
            headshotPercentage: 0,
            agents: {},
            maps: {},
            recentMatches: []
          };

      return {
        account: {
          puuid: account.puuid,
          gameName: account.gameName,
          tagLine: account.tagLine
        },
        rank: null, // Official API doesn't provide rank data
        statistics: stats,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting player profile:', error);
      throw error;
    }
  }
}

module.exports = RiotAPIService;
