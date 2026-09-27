import { drizzle } from 'drizzle-orm/postgres-js';

// Ganti URL koneksi sesuai konfigurasi PostgreSQL Anda
export const db = drizzle(process.env.DATABASE_URL!);
