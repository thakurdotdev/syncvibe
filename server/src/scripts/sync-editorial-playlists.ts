import { syncEditorialPlaylists } from '@/features/music/services/editorial-playlists.service';
import sequelize from '@/utils/sequelize';

syncEditorialPlaylists()
  .catch((error: unknown) => {
    console.error('Editorial playlist sync failed:', error);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
