import { ICricketMatch } from '../models/CricketMatch';

/**
 * Transform Cricket Data API response to your database schema
 */
export function transformApiMatchToDbSchema(apiMatch: any): Partial<ICricketMatch> {
  // Extract team information
  const teams = apiMatch.teams || apiMatch.teamInfo || [];
  const homeTeam = teams[0] || {};
  const awayTeam = teams[1] || {};

  // Extract score information
  const scores = apiMatch.score || [];
  // Try to match scores to teams, fallback to order
  const homeScore = scores.find((s: any) => {
    const inning = s.inning?.toLowerCase() || '';
    const teamName = (homeTeam.name || teams[0] || '').toLowerCase();
    return inning.includes(teamName) || inning.includes('inning 1');
  }) || scores[0] || {};
  
  const awayScore = scores.find((s: any) => {
    const inning = s.inning?.toLowerCase() || '';
    const teamName = (awayTeam.name || teams[1] || '').toLowerCase();
    return inning.includes(teamName) || inning.includes('inning 2');
  }) || scores[1] || {};

  // Determine status
  let status: 'live' | 'completed' | 'upcoming' | 'cancelled' = 'upcoming';
  if (apiMatch.matchStarted && apiMatch.matchEnded) {
    status = 'completed';
  } else if (apiMatch.matchStarted && !apiMatch.matchEnded) {
    status = 'live';
  } else if (apiMatch.status) {
    const statusLower = apiMatch.status.toLowerCase();
    if (statusLower.includes('won') || statusLower.includes('completed') || statusLower.includes('finished')) {
      status = 'completed';
    } else if (statusLower.includes('live') || statusLower.includes('in progress')) {
      status = 'live';
    }
  }

  // Map format
  const formatMap: Record<string, 'test' | 'odi' | 't20i' | 't20' | 'first-class' | 'list-a'> = {
    'test': 'test',
    'odi': 'odi',
    't20i': 't20i',
    't20': 't20',
    'first-class': 'first-class',
    'firstclass': 'first-class',
    'list-a': 'list-a',
    'lista': 'list-a',
  };
  const format = formatMap[apiMatch.matchType?.toLowerCase()] || 't20';

  // Parse venue
  const venueParts = (apiMatch.venue || '').split(',').map((p: string) => p.trim());
  const venue = {
    name: venueParts[0] || 'Unknown Venue',
    city: venueParts[1] || venueParts[0] || 'Unknown',
    country: venueParts[2] || venueParts[1] || 'Unknown',
  };

  return {
    matchId: apiMatch.id || apiMatch.matchId || '',
    series: apiMatch.series_id || apiMatch.series || 'Unknown Series',
    teams: {
      home: {
        id: homeTeam.name || teams[0] || '',
        name: homeTeam.name || teams[0] || 'Team 1',
        flag: homeTeam.img ? '🏏' : '🏏', // API provides image URL, we use emoji as fallback
        shortName: homeTeam.shortname || homeTeam.shortName || (teams[0]?.substring(0, 3).toUpperCase() || 'T1'),
      },
      away: {
        id: awayTeam.name || teams[1] || '',
        name: awayTeam.name || teams[1] || 'Team 2',
        flag: awayTeam.img ? '🏏' : '🏏',
        shortName: awayTeam.shortname || awayTeam.shortName || (teams[1]?.substring(0, 3).toUpperCase() || 'T2'),
      },
    },
    venue,
    status,
    format,
    startTime: apiMatch.dateTimeGMT ? new Date(apiMatch.dateTimeGMT) : (apiMatch.date ? new Date(apiMatch.date) : new Date()),
    currentScore: scores.length > 0 ? {
      home: {
        runs: homeScore.r || 0,
        wickets: homeScore.w || 0,
        overs: parseFloat(homeScore.o?.toString() || '0') || 0,
        balls: Math.floor((parseFloat(homeScore.o?.toString() || '0') % 1) * 10) || 0,
      },
      away: {
        runs: awayScore.r || 0,
        wickets: awayScore.w || 0,
        overs: parseFloat(awayScore.o?.toString() || '0') || 0,
        balls: Math.floor((parseFloat(awayScore.o?.toString() || '0') % 1) * 10) || 0,
      },
    } : undefined,
  };
}

/**
 * Transform API match to frontend format
 */
export function transformApiMatchToFrontend(apiMatch: any): any {
  const transformed = transformApiMatchToDbSchema(apiMatch);
  const matchId = apiMatch.id || apiMatch.matchId;
  
  return {
    _id: matchId,
    matchId: matchId,
    ...transformed,
    name: apiMatch.name || `${transformed.teams?.home.name} vs ${transformed.teams?.away.name}`,
    status: transformed.status,
    format: transformed.format,
    detailUrl: `/cricket/matches/${matchId}`, // Add detail URL for navigation
    matchStarted: apiMatch.matchStarted,
    matchEnded: apiMatch.matchEnded,
  };
}

