import 'dotenv/config';
import { cricketApiService } from '../services/cricketApiService';
import { connectDatabase, disconnectDatabase } from '../utils/database';

async function testApi() {
  try {
    console.log('🧪 Testing Cricket Data API...\n');

    // Check if API key is configured
    const apiKey = process.env.CRICKET_API_KEY;
    const baseUrl = process.env.CRICKET_API_BASE_URL || 'https://api.cricketdata.org/v1';

    if (!apiKey) {
      console.error('❌ CRICKET_API_KEY not found in environment variables!');
      console.log('\n📝 Please add to your .env file:');
      console.log('   CRICKET_API_KEY=your_api_key_here');
      console.log('   CRICKET_API_BASE_URL=https://api.cricketdata.org/v1');
      process.exit(1);
    }

    console.log('✅ API Key found');
    console.log(`✅ Base URL: ${baseUrl}\n`);

    // Test health check (if available)
    try {
      const isHealthy = await cricketApiService.healthCheck();
      console.log(`📊 API Health: ${isHealthy ? '✅ Healthy' : '⚠️  Unhealthy'}\n`);
    } catch (error) {
      console.log('⚠️  Health check endpoint not available (this is okay)\n');
    }

    // Test live matches
    console.log('🔍 Testing live matches endpoint...');
    try {
      const liveMatches = await cricketApiService.getLiveMatches();
      console.log(`✅ Live Matches: ${liveMatches.length} found\n`);

      if (liveMatches.length > 0) {
        console.log('📋 Sample Match:');
        const sample = liveMatches[0];
        console.log(JSON.stringify(sample, null, 2));
      } else {
        console.log('ℹ️  No live matches at the moment');
      }
    } catch (error: any) {
      console.error('❌ Error fetching live matches:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', error.response.data);
      }
    }

    console.log('\n');

    // Test upcoming matches
    console.log('🔍 Testing upcoming matches endpoint...');
    try {
      const upcomingMatches = await cricketApiService.getUpcomingMatches();
      console.log(`✅ Upcoming Matches: ${upcomingMatches.length} found\n`);
    } catch (error: any) {
      console.error('❌ Error fetching upcoming matches:', error.message);
    }

    console.log('\n');

    // Test completed matches
    console.log('🔍 Testing completed matches endpoint...');
    try {
      const completedMatches = await cricketApiService.getCompletedMatches();
      console.log(`✅ Completed Matches: ${completedMatches.length} found\n`);
    } catch (error: any) {
      console.error('❌ Error fetching completed matches:', error.message);
    }

    console.log('\n✅ API test completed!');
    console.log('\n📊 Summary:');
    console.log('   - API Key: ✅ Configured');
    console.log('   - Base URL: ✅ Configured');
    console.log('   - Endpoints: Tested');
    console.log('\n💡 If you see errors, check:');
    console.log('   1. API key is correct');
    console.log('   2. API key has proper permissions');
    console.log('   3. You haven\'t exceeded rate limits');
    console.log('   4. Base URL is correct');

  } catch (error: any) {
    console.error('\n❌ API test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check your API key in .env file');
    console.error('   2. Verify API key is active in dashboard');
    console.error('   3. Check if you\'ve exceeded rate limits');
    console.error('   4. Verify base URL is correct');
  }

  process.exit(0);
}

testApi();

