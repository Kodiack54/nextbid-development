/**
 * Local PostgreSQL Database Client
 * Provides Supabase-compatible interface for local PostgreSQL (kodiack_ai)
 *
 * This replaces @supabase/supabase-js for all dev_* and dev_ai_* tables
 */

import { Pool, PoolClient } from 'pg';

// Create connection pool
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'kodiack_ai',
  user: process.env.PG_USER || 'kodiack_admin',
  password: process.env.PG_PASSWORD || 'K0d1ack_Stud10_2024',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Types
interface QueryResult<T = Record<string, unknown>> {
  data: T | T[] | null;
  error: Error | null;
  count?: number;
}

interface FilterCondition {
  column: string;
  operator: string;
  value: unknown;
}

/**
 * QueryBuilder - Supabase-compatible query builder
 */
class QueryBuilder<T = Record<string, unknown>> {
  private tableName: string;
  private selectColumns: string = '*';
  private filters: FilterCondition[] = [];
  private orFilters: string[] = [];
  private orderByClause: string = '';
  private limitCount: number | null = null;
  private offsetCount: number | null = null;
  private insertData: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private updateData: Record<string, unknown> | null = null;
  private isDelete: boolean = false;
  private returnData: boolean = false;
  private isSingle: boolean = false;
  private isCount: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns: string = '*'): this {
    // Handle Supabase-style joins like 'id, name, dev_users(name, email)'
    // For now, just use the columns as-is (joins will need special handling)
    if (columns.includes('(')) {
      // Has joins - for now just extract main columns
      this.selectColumns = columns.split(',')
        .map(c => c.trim())
        .filter(c => !c.includes('('))
        .join(', ') || '*';
    } else {
      this.selectColumns = columns;
    }
    this.returnData = true;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, operator: '=', value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ column, operator: '!=', value });
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push({ column, operator: '>', value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ column, operator: '>=', value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ column, operator: '<', value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this.filters.push({ column, operator: '<=', value });
    return this;
  }

  like(column: string, pattern: string): this {
    this.filters.push({ column, operator: 'LIKE', value: pattern });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.filters.push({ column, operator: 'ILIKE', value: pattern });
    return this;
  }

  is(column: string, value: unknown): this {
    if (value === null) {
      this.filters.push({ column, operator: 'IS', value: 'NULL' });
    } else {
      this.filters.push({ column, operator: 'IS', value });
    }
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ column, operator: 'IN', value: values });
    return this;
  }

  contains(column: string, value: unknown): this {
    this.filters.push({ column, operator: '@>', value });
    return this;
  }

  or(conditions: string): this {
    this.orFilters.push(conditions);
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}): this {
    const direction = options.ascending === false ? 'DESC' : 'ASC';
    this.orderByClause = `ORDER BY ${column} ${direction}`;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  offset(count: number): this {
    this.offsetCount = count;
    return this;
  }

  single(): this {
    this.isSingle = true;
    this.limitCount = 1;
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]): this {
    this.insertData = data;
    return this;
  }

  update(data: Record<string, unknown>): this {
    this.updateData = data;
    return this;
  }

  delete(): this {
    this.isDelete = true;
    return this;
  }

  private buildWhereClause(): { clause: string; values: unknown[] } {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const filter of this.filters) {
      if (filter.operator === 'IS') {
        conditions.push(`${filter.column} IS ${filter.value}`);
      } else if (filter.operator === 'IN') {
        const arr = filter.value as unknown[];
        const placeholders = arr.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`${filter.column} IN (${placeholders})`);
        values.push(...arr);
      } else if (filter.operator === '@>') {
        conditions.push(`${filter.column} @> $${paramIndex++}`);
        values.push(JSON.stringify(filter.value));
      } else {
        conditions.push(`${filter.column} ${filter.operator} $${paramIndex++}`);
        values.push(filter.value);
      }
    }

    // Handle OR conditions (simplified)
    for (const orCondition of this.orFilters) {
      conditions.push(`(${orCondition})`);
    }

    const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { clause, values };
  }

  async execute(): Promise<QueryResult<T>> {
    let client: PoolClient | null = null;

    try {
      client = await pool.connect();

      // INSERT
      if (this.insertData) {
        const dataArray = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        const columns = Object.keys(dataArray[0]);
        const results: T[] = [];

        for (const row of dataArray) {
          const values = columns.map(col => row[col]);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const returning = this.returnData ? 'RETURNING *' : '';

          const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) ${returning}`;
          const result = await client.query(query, values);

          if (this.returnData && result.rows.length > 0) {
            results.push(result.rows[0] as T);
          }
        }

        return {
          data: this.isSingle ? (results[0] || null) : results,
          error: null,
        };
      }

      // UPDATE
      if (this.updateData) {
        const columns = Object.keys(this.updateData);
        const { clause: whereClause, values: whereValues } = this.buildWhereClause();

        const setClause = columns
          .map((col, i) => `${col} = $${i + 1}`)
          .join(', ');

        const updateValues = columns.map(col => this.updateData![col]);
        const allValues = [...updateValues, ...whereValues.map((v, i) => {
          // Adjust parameter indices
          return v;
        })];

        // Rebuild where clause with adjusted indices
        let adjustedWhere = whereClause;
        whereValues.forEach((_, i) => {
          const oldIndex = i + 1;
          const newIndex = columns.length + i + 1;
          adjustedWhere = adjustedWhere.replace(`$${oldIndex}`, `$${newIndex}`);
        });

        const returning = this.returnData ? 'RETURNING *' : '';
        const query = `UPDATE ${this.tableName} SET ${setClause} ${adjustedWhere} ${returning}`;

        const result = await client.query(query, [...updateValues, ...whereValues]);

        return {
          data: this.isSingle ? (result.rows[0] as T || null) : (result.rows as T[]),
          error: null,
        };
      }

      // DELETE
      if (this.isDelete) {
        const { clause: whereClause, values } = this.buildWhereClause();
        const returning = this.returnData ? 'RETURNING *' : '';
        const query = `DELETE FROM ${this.tableName} ${whereClause} ${returning}`;

        const result = await client.query(query, values);
        return {
          data: result.rows as T[],
          error: null,
        };
      }

      // SELECT
      const { clause: whereClause, values } = this.buildWhereClause();
      let query = `SELECT ${this.selectColumns} FROM ${this.tableName} ${whereClause}`;

      if (this.orderByClause) {
        query += ` ${this.orderByClause}`;
      }

      if (this.limitCount !== null) {
        query += ` LIMIT ${this.limitCount}`;
      }

      if (this.offsetCount !== null) {
        query += ` OFFSET ${this.offsetCount}`;
      }

      const result = await client.query(query, values);

      if (this.isSingle) {
        return {
          data: result.rows[0] as T || null,
          error: null,
        };
      }

      return {
        data: result.rows as T[],
        error: null,
        count: result.rowCount || 0,
      };

    } catch (error) {
      console.error('[DB Error]', error);
      return {
        data: null,
        error: error as Error,
      };
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // Make the query builder thenable for async/await
  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * Database client with Supabase-compatible interface
 */
export const db = {
  from<T = Record<string, unknown>>(tableName: string): QueryBuilder<T> {
    return new QueryBuilder<T>(tableName);
  },

  // Direct query access for complex queries
  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    let client: PoolClient | null = null;
    try {
      client = await pool.connect();
      const result = await client.query(sql, params);
      return {
        data: result.rows as T[],
        error: null,
        count: result.rowCount || 0,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
      };
    } finally {
      if (client) {
        client.release();
      }
    }
  },

  // Get the pool for advanced usage
  getPool(): Pool {
    return pool;
  },
};

// For backwards compatibility, also export as createClient
export function createLocalClient() {
  return db;
}

export default db;
