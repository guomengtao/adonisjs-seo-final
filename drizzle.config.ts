import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  schema: './schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1',
  dbCredentials: {
    accountId: process.env.CF_ACCOUNT_ID || '',
    databaseId: 'missing-persons-db',
    token: process.env.CF_API_TOKEN || '',
  },
});