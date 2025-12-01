import 'dotenv/config';
import axios from 'axios';

async function testUpcomingMatches() {
  const apiKey = process.env.CRICKET_API_KEY;
  const baseUrl = process.env.CRICKET_API_BASE_URL || 'https://api.cricapi.com/v1';

  if (!apiKey) {
    console.error('❌ CRICKET_API_KEY not found in .env file.');
    return;
  }

  console.log('🧪 Testing Upcoming Matches API...');
  console.log(`📡 Base URL: ${baseUrl}`);
  console.log(`🔑 API Key: ${apiKey.substring(0, 8)}...`);

  try {
    // Test 1: Get all matches
    console.log('\n📋 Test 1: Fetching all matches...');
    const response = await axios.get(`${baseUrl}/matches`, {
      params: {
        apikey: apiKey
      },
      timeout: 10000
    });

    console.log(`✅ Response Status: ${response.data.status}`);
    console.log(`📊 Total Matches: ${response.data.data?.length || 0}`);

    if (response.data.data && response.data.data.length > 0) {
      const allMatches = response.data.data;
      console.log('\n📋 Sample Match:');
      console.log(JSON.stringify(allMatches[0], null, 2));

      // Filter upcoming matches
      const now = new Date();
      const upcomingMatches = allMatches.filter((match: any) => {
        if (!match.dateTimeGMT && !match.date) {
          return false;
        }
        const matchDate = new Date(match.dateTimeGMT || match.date);
        return !match.matchStarted && 
               !match.matchEnded && 
               matchDate > now;
      });

      console.log(`\n✅ Upcoming Matches Found: ${upcomingMatches.length}`);
      
      if (upcomingMatches.length > 0) {
        console.log('\n📋 Sample Upcoming Match:');
        console.log(JSON.stringify(upcomingMatches[0], null, 2));
        console.log(`\n📅 Match Date: ${upcomingMatches[0].dateTimeGMT || upcomingMatches[0].date}`);
        console.log(`🏏 Match Started: ${upcomingMatches[0].matchStarted}`);
        console.log(`🏁 Match Ended: ${upcomingMatches[0].matchEnded}`);
      } else {
        console.log('\n⚠️  No upcoming matches found. Checking why...');
        console.log('\n📊 Match Status Breakdown:');
        const statusBreakdown = {
          total: allMatches.length,
          started: allMatches.filter((m: any) => m.matchStarted).length,
          ended: allMatches.filter((m: any) => m.matchEnded).length,
          noDate: allMatches.filter((m: any) => !m.dateTimeGMT && !m.date).length,
          pastDate: allMatches.filter((m: any) => {
            if (!m.dateTimeGMT && !m.date) return false;
            const matchDate = new Date(m.dateTimeGMT || m.date);
            return matchDate <= now;
          }).length
        };
        console.log(JSON.stringify(statusBreakdown, null, 2));
      }
    } else {
      console.log('⚠️  No matches returned from API');
      console.log('📋 Full Response:');
      console.log(JSON.stringify(response.data, null, 2));
    }

    // Test 2: Try with status parameter
    console.log('\n📋 Test 2: Fetching with status=upcoming...');
    try {
      const response2 = await axios.get(`${baseUrl}/matches`, {
        params: {
          apikey: apiKey,
          status: 'upcoming'
        },
        timeout: 10000
      });
      console.log(`✅ Response Status: ${response2.data.status}`);
      console.log(`📊 Matches with status=upcoming: ${response2.data.data?.length || 0}`);
    } catch (error: any) {
      console.log(`⚠️  Error with status parameter: ${error.message}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('📋 Response Status:', error.response.status);
      console.error('📋 Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.config) {
      console.error('📋 Request URL:', error.config.url);
      console.error('📋 Request Params:', error.config.params);
    }
  }
}

testUpcomingMatches();

