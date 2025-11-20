import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../utils/database';
import { User } from '../models/User';

async function createAdmin() {
  try {
    await connectDatabase();

    const email = process.env.ADMIN_EMAIL || 'admin@onescore.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const name = process.env.ADMIN_NAME || 'Admin User';

    // Check if admin already exists
    const existing = await User.findOne({ email });
    if (existing) {
      console.log('Admin user already exists. Deleting and recreating...');
      await User.deleteOne({ email });
    }
    
    // Always create fresh to ensure password is hashed correctly
    // Note: User model has a pre-save hook that hashes the password automatically
    {
      // Create new admin user - password will be hashed by User model pre-save hook
      const admin = await User.create({
        name,
        email,
        password, // Raw password - will be hashed by pre-save hook
        role: 'admin',
        isVerified: true,
      });

      console.log('✅ Admin user created successfully!');
      console.log('Email:', email);
      console.log('Password:', password);
      console.log('Role: admin');
      console.log('User ID:', admin._id);
    }

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

createAdmin();

