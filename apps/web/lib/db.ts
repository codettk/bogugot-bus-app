import { Pool, type QueryResultRow } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]) =>
    pool.query<T>(text, values),
}
