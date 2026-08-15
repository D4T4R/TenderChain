require('dotenv').config();

/**
 * migrate-mongo configuration.
 *
 * Index creation lives in migrations rather than relying on Mongoose autoIndex,
 * which is disabled outside development (see config/database.js). This keeps
 * index changes reviewable and repeatable instead of being an implicit side
 * effect of booting the app.
 */
const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/tenderchain';

// migrate-mongo wants the database name separately from the connection string.
function databaseNameFromUri(uri) {
  const withoutQuery = uri.split('?')[0];
  const name = withoutQuery.substring(withoutQuery.lastIndexOf('/') + 1);
  return name || 'tenderchain';
}

module.exports = {
  mongodb: {
    url,
    databaseName: databaseNameFromUri(url),
    options: {
      serverSelectionTimeoutMS: 5000,
    },
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  lockCollectionName: 'changelog_lock',
  lockTtl: 0,
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'commonjs',
};
