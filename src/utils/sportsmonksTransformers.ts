/**
 * Transform SportsMonks API response to frontend format
 */

export function transformSportsMonksMatchToFrontend(apiMatch: any, sport: 'cricket' | 'football' = 'cricket'): any {
  // Extract participants (teams)
  const participants = apiMatch.participants || [];
  const homeParticipant = participants.find((p: any) => p.meta?.location === 'home') || participants[0] || {};
  const awayParticipant = participants.find((p: any) => p.meta?.location === 'away') || participants[1] || {};

  // Extract scores
  const scores = apiMatch.scores || [];
  const homeScore = scores.find((s: any) => s.scoreboard === '1' || s.participant_id === homeParticipant.id) || scores[0] || {};
  const awayScore = scores.find((s: any) => s.scoreboard === '2' || s.participant_id === awayParticipant.id) || scores[1] || {};

  // Determine status
  let status: 'live' | 'completed' | 'upcoming' | 'cancelled' = 'upcoming';
  const stateId = apiMatch.state_id;
  
  if (stateId === 5 || stateId === 6) {
    // 5 = Finished, 6 = After Extra Time, etc.
    status = 'completed';
  } else if (stateId === 3 || stateId === 4) {
    // 3 = In Progress, 4 = To Be Announced (but might be live)
    status = 'live';
  } else if (stateId === 1) {
    // 1 = Not Started
    status = 'upcoming';
  }

  // Extract venue
  const venue = apiMatch.venue || {};
  const venueData = {
    name: venue.name || 'Unknown Venue',
    city: venue.city || 'Unknown',
    country: venue.country || 'Unknown',
  };

  // For cricket, extract format
  let format: string = 't20';
  if (sport === 'cricket') {
    const typeId = apiMatch.type_id;
    // Map type_id to format (this might need adjustment based on actual API response)
    if (typeId === 1) format = 'test';
    else if (typeId === 2) format = 'odi';
    else if (typeId === 3) format = 't20';
    else format = 't20';
  }

  // Build teams object
  const teams = {
    home: {
      id: homeParticipant.id?.toString() || '',
      name: homeParticipant.name || 'Team 1',
      flag: homeParticipant.image_path ? `🏏` : '🏏', // You might want to use actual flag images
      shortName: homeParticipant.short_code || homeParticipant.name?.substring(0, 3).toUpperCase() || 'T1',
    },
    away: {
      id: awayParticipant.id?.toString() || '',
      name: awayParticipant.name || 'Team 2',
      flag: awayParticipant.image_path ? `🏏` : '🏏',
      shortName: awayParticipant.short_code || awayParticipant.name?.substring(0, 3).toUpperCase() || 'T2',
    },
  };

  // Build current score (for live matches)
  let currentScore: any = undefined;
  if (status === 'live' && scores.length > 0) {
    if (sport === 'football') {
      // Football: goals are stored in score field
      currentScore = {
        home: {
          runs: homeScore.score || 0, // For football, "runs" represents goals
          wickets: 0,
          overs: 0,
          balls: 0,
        },
        away: {
          runs: awayScore.score || 0, // For football, "runs" represents goals
          wickets: 0,
          overs: 0,
          balls: 0,
        },
      };
    } else {
      // Cricket: runs/wickets/overs
      currentScore = {
        home: {
          runs: homeScore.score || 0,
          wickets: homeScore.wickets || 0,
          overs: parseFloat(homeScore.overs?.toString() || '0') || 0,
          balls: 0,
        },
        away: {
          runs: awayScore.score || 0,
          wickets: awayScore.wickets || 0,
          overs: parseFloat(awayScore.overs?.toString() || '0') || 0,
          balls: 0,
        },
      };
    }
  }

  // Build final score (for completed matches)
  let score: any = undefined;
  if (status === 'completed' && scores.length > 0) {
    score = {
      home: homeScore.score || 0,
      away: awayScore.score || 0,
    };
  }

  return {
    _id: apiMatch.id?.toString(),
    matchId: apiMatch.id?.toString(),
    name: apiMatch.name || `${teams.home.name} vs ${teams.away.name}`,
    teams,
    venue: venueData,
    status,
    format: sport === 'cricket' ? format : undefined,
    league: sport === 'football' ? apiMatch.league?.name : undefined,
    startTime: apiMatch.starting_at ? new Date(apiMatch.starting_at) : new Date(),
    currentScore,
    score,
    matchStarted: status === 'live' || status === 'completed',
    matchEnded: status === 'completed',
    series: apiMatch.league?.name || apiMatch.season?.name || 'Unknown Series',
    detailUrl: sport === 'football' ? `/football/match/${apiMatch.id}` : `/cricket/match/${apiMatch.id}`,
  };
}

