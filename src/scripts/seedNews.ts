import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../utils/database';
import { NewsArticle } from '../models/NewsArticle';
import { NewsRevision } from '../models/NewsRevision';
import { User } from '../models/User';

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

function buildSlug(date: Date, rawSlug: string) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `news/${yyyy}/${mm}/${rawSlug}`;
}

async function seed() {
  await connectDatabase();

  const now = new Date();
  let author = await User.findOne();
  if (!author) {
    author = await User.create({
      name: 'News Bot',
      email: 'newsbot@example.com',
      password: 'Password123!',
      role: 'admin',
      isVerified: true,
    } as any);
  }
  const samples = [
    {
      title: 'India edge Australia in thriller: last-over drama in Mumbai',
      summary: 'A dramatic finish sees India clinch a narrow win after late wickets.',
      body: '<p>In a pulsating contest, India held their nerve in the final over to seal victory. The middle order contributed crucial runs, while the bowlers executed yorkers under pressure.</p>',
      type: 'match_report',
      category: 'cricket',
      tags: ['india', 'australia', 'mumbai', 'match report'],
      heroImage: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1600&auto=format&fit=crop',
    },
    {
      title: 'Tactical preview: Liverpool vs Manchester City showdown',
      summary: 'High press or controlled tempo? Key battles to decide the top-of-table clash.',
      body: '<p>Liverpool’s aggressive press will test City’s build-up structure. The transitions in half-spaces and the duel between full-backs could shape the outcome.</p>',
      type: 'analysis',
      category: 'football',
      tags: ['liverpool', 'manchester city', 'tactics', 'preview'],
      heroImage: 'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?q=80&w=1600&auto=format&fit=crop',
    },
    {
      title: 'The rise of young finishers in T20 cricket',
      summary: 'A new generation excels at closing out innings with composure and power.',
      body: '<p>Strike rotation and matchup awareness have elevated the modern T20 finisher. Training methods and data-driven roles are redefining end-overs batting.</p>',
      type: 'feature',
      category: 'cricket',
      tags: ['t20', 'finisher', 'analysis'],
      heroImage: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=1600&auto=format&fit=crop',
    },
  ];

  for (const s of samples) {
    const baseSlug = slugify(s.title);
    const slug = buildSlug(now, baseSlug);

    const exists = await NewsArticle.findOne({ slug });
    if (exists) continue;

    const created = await NewsArticle.create({
      title: s.title,
      slug,
      summary: s.summary,
      body: s.body,
      type: s.type as any,
      category: s.category as any,
      tags: s.tags,
      heroImage: s.heroImage,
      gallery: [],
      author: author._id,
      state: 'published',
      publishedAt: now,
    });

    await NewsRevision.create({ articleId: created._id, snapshot: created.toObject(), editorId: created._id, note: 'seed' });
    // eslint-disable-next-line no-console
    console.log('Seeded article:', created.slug);
  }

  await disconnectDatabase();
}

seed().catch(async (e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  await disconnectDatabase();
  process.exit(1);
});


