import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../utils/database';
import { Thread } from '../models/Thread';
import { User } from '../models/User';
import mongoose from 'mongoose';

// Sample thread data with variety
const threadTemplates = [
  // Cricket threads
  {
    title: 'Virat Kohli\'s century in the World Cup final was absolutely phenomenal!',
    content: 'What a performance from the King! The way he paced his innings and finished with a century in the final was just incredible. The pressure was immense, but he delivered when it mattered most. This is why he\'s considered one of the greatest of all time.',
    category: 'cricket' as const,
    tags: ['virat-kohli', 'world-cup', 'century', 'india'],
    flair: 'Match Discussion',
    upvotes: 245,
    downvotes: 12,
    views: 1847,
    commentCount: 89,
    hasMedia: true,
    mediaType: 'image' as const,
  },
  {
    title: 'Should India consider resting Bumrah for the next series?',
    content: 'With the packed schedule ahead, I think it\'s time we give Bumrah some rest. He\'s been playing non-stop and we need him fresh for the World Cup. What do you all think?',
    category: 'cricket' as const,
    tags: ['jasprit-bumrah', 'india', 'workload-management'],
    flair: 'Discussion',
    upvotes: 156,
    downvotes: 23,
    views: 923,
    commentCount: 45,
    hasPoll: true,
    pollQuestion: 'Should Bumrah be rested?',
    pollOptions: ['Yes, rest him', 'No, he should play', 'Only for non-critical matches'],
  },
  {
    title: 'The rise of spin bowling in modern T20 cricket',
    content: 'We\'re seeing a revolution in T20 cricket where spinners are becoming match-winners. The variations, the control, and the ability to bowl in the powerplay - it\'s changing the game completely.',
    category: 'cricket' as const,
    tags: ['t20', 'spin-bowling', 'analysis'],
    flair: 'Analysis',
    upvotes: 189,
    downvotes: 8,
    views: 1245,
    commentCount: 67,
  },
  {
    title: 'IPL 2024: Best XI from the first half',
    content: 'Let\'s discuss the standout performers from the first half of IPL 2024. Who would make your best XI?',
    category: 'cricket' as const,
    tags: ['ipl', '2024', 'best-xi', 'discussion'],
    flair: 'IPL',
    upvotes: 312,
    downvotes: 15,
    views: 2134,
    commentCount: 124,
    isPinned: true,
  },
  {
    title: 'Breaking: Major injury update on key player',
    content: 'According to sources, the player has been ruled out for the next 3 months. This is a huge blow to the team\'s chances in the upcoming tournament.',
    category: 'news' as const,
    tags: ['injury', 'breaking-news'],
    flair: 'Breaking News',
    upvotes: 89,
    downvotes: 5,
    views: 567,
    commentCount: 23,
  },
  // Football threads
  {
    title: 'Manchester City vs Liverpool: Tactical breakdown',
    content: 'The high press from Liverpool against City\'s build-up play was fascinating. Let\'s analyze the key tactical moments that decided this match.',
    category: 'football' as const,
    tags: ['manchester-city', 'liverpool', 'tactics', 'premier-league'],
    flair: 'Tactical Analysis',
    upvotes: 278,
    downvotes: 19,
    views: 1654,
    commentCount: 98,
    hasMedia: true,
    mediaType: 'video' as const,
  },
  {
    title: 'Who is the best striker in the Premier League right now?',
    content: 'With so many world-class strikers in the league, who do you think is currently the best? Haaland, Kane, or someone else?',
    category: 'football' as const,
    tags: ['premier-league', 'strikers', 'discussion'],
    flair: 'Discussion',
    upvotes: 201,
    downvotes: 34,
    views: 1123,
    commentCount: 76,
    hasPoll: true,
    pollQuestion: 'Best Premier League striker?',
    pollOptions: ['Erling Haaland', 'Harry Kane', 'Mohamed Salah', 'Ollie Watkins'],
  },
  {
    title: 'Champions League quarter-final predictions',
    content: 'The draw is out! Who do you think will make it to the semi-finals? Let\'s discuss the matchups and potential upsets.',
    category: 'football' as const,
    tags: ['champions-league', 'predictions', 'quarter-finals'],
    flair: 'Predictions',
    upvotes: 167,
    downvotes: 11,
    views: 987,
    commentCount: 54,
  },
  {
    title: 'The evolution of the false 9 role in modern football',
    content: 'From Messi to Firmino, the false 9 has evolved significantly. How do you see this role developing in the future?',
    category: 'football' as const,
    tags: ['tactics', 'false-9', 'analysis'],
    flair: 'Tactical Analysis',
    upvotes: 134,
    downvotes: 7,
    views: 756,
    commentCount: 42,
  },
  // General discussion threads
  {
    title: 'What makes a great sports commentator?',
    content: 'We\'ve all heard great and terrible commentary. What qualities do you think make a commentator truly great?',
    category: 'general' as const,
    tags: ['commentary', 'discussion'],
    flair: 'General Discussion',
    upvotes: 98,
    downvotes: 12,
    views: 634,
    commentCount: 38,
  },
  {
    title: 'Best sports documentaries to watch',
    content: 'Share your favorite sports documentaries! I\'ll start: The Last Dance is absolutely incredible.',
    category: 'general' as const,
    tags: ['documentaries', 'recommendations'],
    flair: 'Recommendations',
    upvotes: 145,
    downvotes: 3,
    views: 823,
    commentCount: 67,
  },
  {
    title: 'How has technology changed sports viewing experience?',
    content: 'From VAR to Hawk-Eye, technology is everywhere in sports now. Do you think it\'s improved the experience or taken away the human element?',
    category: 'general' as const,
    tags: ['technology', 'sports', 'discussion'],
    flair: 'Discussion',
    upvotes: 112,
    downvotes: 18,
    views: 712,
    commentCount: 49,
  },
  // News threads
  {
    title: 'Major transfer window update: Star player signs new contract',
    content: 'Breaking news: The player has signed a 5-year extension with the club. This is huge for the team\'s future plans.',
    category: 'news' as const,
    tags: ['transfer', 'contract', 'breaking-news'],
    flair: 'Transfer News',
    upvotes: 223,
    downvotes: 9,
    views: 1456,
    commentCount: 78,
    isPinned: true,
  },
  {
    title: 'New format announced for upcoming tournament',
    content: 'The organizing committee has revealed a new format that will make the tournament more exciting. Here are the key changes...',
    category: 'news' as const,
    tags: ['tournament', 'format', 'announcement'],
    flair: 'News',
    upvotes: 156,
    downvotes: 14,
    views: 934,
    commentCount: 45,
  },
  {
    title: 'Injury update: Player returns to training',
    content: 'Great news! The player has returned to full training after recovering from injury. Expected to be available for selection next week.',
    category: 'news' as const,
    tags: ['injury', 'recovery', 'training'],
    flair: 'Injury Update',
    upvotes: 89,
    downvotes: 4,
    views: 567,
    commentCount: 28,
  },
  // Discussion threads
  {
    title: 'Should there be a salary cap in cricket leagues?',
    content: 'With the increasing disparity in player salaries, do you think implementing a salary cap would make leagues more competitive?',
    category: 'discussion' as const,
    tags: ['salary-cap', 'cricket', 'leagues', 'discussion'],
    flair: 'Discussion',
    upvotes: 178,
    downvotes: 45,
    views: 1023,
    commentCount: 89,
    hasPoll: true,
    pollQuestion: 'Should cricket leagues have salary caps?',
    pollOptions: ['Yes, definitely', 'No, let market decide', 'Maybe, with exceptions'],
  },
  {
    title: 'The impact of social media on athletes\' mental health',
    content: 'Social media has become a double-edged sword for athletes. While it helps them connect with fans, the trolling and pressure can be overwhelming. What are your thoughts?',
    category: 'discussion' as const,
    tags: ['mental-health', 'social-media', 'athletes'],
    flair: 'Discussion',
    upvotes: 234,
    downvotes: 12,
    views: 1345,
    commentCount: 112,
  },
  {
    title: 'Best underrated players who deserve more recognition',
    content: 'Let\'s discuss players who consistently perform but don\'t get the recognition they deserve. Who comes to mind?',
    category: 'discussion' as const,
    tags: ['underrated', 'players', 'recognition'],
    flair: 'Discussion',
    upvotes: 167,
    downvotes: 8,
    views: 912,
    commentCount: 64,
  },
  // More cricket threads
  {
    title: 'Test cricket vs T20: Which format is more challenging?',
    content: 'Both formats require different skills. Test cricket tests your patience and technique, while T20 tests your adaptability. Which do you think is more challenging?',
    category: 'cricket' as const,
    tags: ['test-cricket', 't20', 'format-comparison'],
    flair: 'Discussion',
    upvotes: 198,
    downvotes: 34,
    views: 1156,
    commentCount: 87,
  },
  {
    title: 'The art of reverse swing: A dying art?',
    content: 'With the new ball rules and pitch conditions, reverse swing seems to be less common. Is this art form dying, or are bowlers just not skilled enough?',
    category: 'cricket' as const,
    tags: ['reverse-swing', 'bowling', 'technique'],
    flair: 'Analysis',
    upvotes: 145,
    downvotes: 9,
    views: 834,
    commentCount: 56,
  },
  {
    title: 'Women\'s cricket is reaching new heights!',
    content: 'The quality of women\'s cricket has improved dramatically. The recent World Cup was one of the best tournaments I\'ve ever watched. What do you think?',
    category: 'cricket' as const,
    tags: ['womens-cricket', 'world-cup'],
    flair: 'Discussion',
    upvotes: 267,
    downvotes: 6,
    views: 1567,
    commentCount: 98,
  },
  // More football threads
  {
    title: 'The best young talents to watch this season',
    content: 'Every season brings new young stars. Who are the players under 21 that you\'re most excited about?',
    category: 'football' as const,
    tags: ['young-talents', 'prospects', 'football'],
    flair: 'Discussion',
    upvotes: 189,
    downvotes: 11,
    views: 1089,
    commentCount: 72,
  },
  {
    title: 'VAR: Friend or foe?',
    content: 'VAR has been controversial since its introduction. Has it improved the game or made it worse? Share your experiences and thoughts.',
    category: 'football' as const,
    tags: ['var', 'technology', 'controversy'],
    flair: 'Discussion',
    upvotes: 156,
    downvotes: 67,
    views: 1234,
    commentCount: 134,
    hasPoll: true,
    pollQuestion: 'Is VAR good for football?',
    pollOptions: ['Yes, it\'s necessary', 'No, it ruins the game', 'Needs improvement'],
  },
];

// Sample media URLs
const sampleMedia = {
  image: [
    {
      url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800',
      thumbnail: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=400',
      title: 'Cricket Match Action',
      description: 'Intense moment from the match',
    },
    {
      url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
      thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400',
      title: 'Football Stadium',
      description: 'Beautiful view of the stadium',
    },
  ],
  video: [
    {
      url: 'https://example.com/video1.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?w=400',
      title: 'Match Highlights',
      description: 'Key moments from the game',
    },
  ],
  link: [
    {
      url: 'https://example.com/article',
      thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400',
      title: 'Related Article',
      description: 'Read more about this topic',
    },
  ],
};

// Sample user names for variety
const sampleUserNames = [
  'SportsFan2024',
  'CricketLover',
  'FootballExpert',
  'MatchAnalyst',
  'GameWatcher',
  'SportsEnthusiast',
  'TeamSupporter',
  'MatchCommentator',
  'SportsWriter',
  'FanAccount',
];

async function seedThreads() {
  try {
    await connectDatabase();
    console.log('✅ Connected to MongoDB Atlas');

    // Get or create users
    let users = await User.find().limit(10).lean();
    
    if (users.length < 5) {
      console.log('⚠️  Not enough users found. Creating sample users...');
      const newUsers = [];
      for (let i = 0; i < 10; i++) {
        try {
          // Check if user already exists
          const existing = await User.findOne({ email: `user${i + 1}@example.com` });
          if (existing) {
            newUsers.push(existing.toObject());
            continue;
          }
          
          const user = await User.create({
            name: sampleUserNames[i] || `User${i + 1}`,
            email: `user${i + 1}@example.com`,
            password: 'Password123!',
            role: i === 0 ? 'admin' : 'user',
            isVerified: true,
          });
          newUsers.push(user.toObject());
        } catch (error: any) {
          // If user exists, fetch it
          if (error.code === 11000) {
            const existing = await User.findOne({ email: `user${i + 1}@example.com` }).lean();
            if (existing) newUsers.push(existing);
          } else {
            console.error(`Error creating user ${i + 1}:`, error.message);
          }
        }
      }
      users = newUsers;
      console.log(`✅ Created/found ${users.length} users`);
    } else {
      console.log(`✅ Found ${users.length} existing users`);
    }
    
    if (users.length === 0) {
      throw new Error('No users available. Please create at least one user first.');
    }

    // Clear existing threads (optional - comment out if you want to keep existing)
    const existingCount = await Thread.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing threads. Deleting...`);
      await Thread.deleteMany({});
      console.log('✅ Cleared existing threads');
    }

    // Generate threads
    const threads = [];
    const now = new Date();
    
    for (let i = 0; i < threadTemplates.length; i++) {
      const template = threadTemplates[i];
      const author = users[Math.floor(Math.random() * users.length)];
      
      // Randomize dates (some recent, some older)
      const daysAgo = Math.floor(Math.random() * 30); // Last 30 days
      const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const lastActivity = new Date(createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000); // Activity within 7 days of creation
      
      const threadData: any = {
        title: template.title,
        content: template.content,
        author: author._id,
        category: template.category,
        tags: template.tags,
        flair: template.flair,
        upvotes: template.upvotes,
        downvotes: template.downvotes,
        score: template.upvotes - template.downvotes,
        views: template.views,
        comments: [],
        commentCount: template.commentCount,
        lastActivity: lastActivity,
        isLocked: false,
        isPinned: template.isPinned || false,
        isDeleted: false,
        awards: [],
        reports: [],
        moderators: [],
        createdAt: createdAt,
        updatedAt: createdAt,
      };

      // Add media if specified
      if (template.hasMedia && template.mediaType) {
        const mediaOptions = sampleMedia[template.mediaType];
        if (mediaOptions && mediaOptions.length > 0) {
          threadData.media = mediaOptions[Math.floor(Math.random() * mediaOptions.length)];
        }
      }

      // Add poll if specified
      if (template.hasPoll && template.pollQuestion && template.pollOptions) {
        const pollOptions = template.pollOptions.map(opt => ({
          text: opt,
          votes: Math.floor(Math.random() * 50), // Random votes
        }));
        const totalVotes = pollOptions.reduce((sum, opt) => sum + opt.votes, 0);
        
        threadData.poll = {
          question: template.pollQuestion,
          options: pollOptions,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
          allowMultiple: false,
          totalVotes: totalVotes,
        };
      }

      // Randomly add some awards (10% chance)
      if (Math.random() < 0.1) {
        const awardTypes = ['gold', 'silver', 'helpful', 'insightful'];
        threadData.awards = [{
          type: awardTypes[Math.floor(Math.random() * awardTypes.length)],
          count: Math.floor(Math.random() * 5) + 1,
          givenBy: users[Math.floor(Math.random() * users.length)]._id,
          givenAt: new Date(createdAt.getTime() + Math.random() * 5 * 24 * 60 * 60 * 1000),
        }];
      }

      threads.push(threadData);
    }

    // Insert threads
    const createdThreads = await Thread.insertMany(threads);
    console.log(`✅ Created ${createdThreads.length} threads`);

    // Summary
    const categoryCounts: Record<string, number> = {};
    createdThreads.forEach(thread => {
      categoryCounts[thread.category] = (categoryCounts[thread.category] || 0) + 1;
    });

    console.log('\n📊 Thread Summary:');
    console.log(`Total threads: ${createdThreads.length}`);
    Object.entries(categoryCounts).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });
    console.log(`\n✅ Successfully seeded threads to MongoDB Atlas!`);

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding threads:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

seedThreads();

