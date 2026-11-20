// Runs before every test file — must set env before `config/env` is imported.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://placeholder/doctor-tracker-test';
process.env.COOKIE_NAME = 'dt_session';
