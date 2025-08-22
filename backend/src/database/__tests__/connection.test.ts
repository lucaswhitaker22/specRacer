import { DatabaseConnection, DatabaseConfig } from '../connection';

// Mock pg module
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: jest.fn(),
    }),
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    on: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  })),
}));

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('SELECT 1;'),
}));

describe('DatabaseConnection', () => {
  let dbConfig: DatabaseConfig;
  let db: DatabaseConnection;

  beforeEach(() => {
    dbConfig = {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      user: 'test_user',
      password: 'test_password',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a database connection with default pool settings', () => {
      db = new (DatabaseConnection as any)(dbConfig);
      expect(db).toBeInstanceOf(DatabaseConnection);
    });

    it('should create a database connection with custom pool settings', () => {
      const customConfig = {
        ...dbConfig,
        max: 10,
        idleTimeoutMillis: 15000,
        connectionTimeoutMillis: 1000,
      };
      
      db = new (DatabaseConnection as any)(customConfig);
      expect(db).toBeInstanceOf(DatabaseConnection);
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      db = new (DatabaseConnection as any)(dbConfig);
    });

    it('should initialize database connection successfully', async () => {
      await expect(db.initialize()).resolves.not.toThrow();
    });

    it('should handle initialization errors', async () => {
      const mockPool = (db as any).pool;
      mockPool.connect.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(db.initialize()).rejects.toThrow('Connection failed');
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      db = new (DatabaseConnection as any)(dbConfig);
      await db.initialize();
    });

    it('should execute queries successfully', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      const mockPool = (db as any).pool;
      mockPool.query.mockResolvedValueOnce(mockResult);

      const result = await db.query('SELECT * FROM test');
      expect(result).toEqual(mockResult);
    });

    it('should handle query errors', async () => {
      const mockPool = (db as any).pool;
      mockPool.query.mockRejectedValueOnce(new Error('Query failed'));

      await expect(db.query('INVALID SQL')).rejects.toThrow('Query failed');
    });

    it('should throw error when not connected', async () => {
      const disconnectedDb = new (DatabaseConnection as any)(dbConfig);
      
      await expect(disconnectedDb.query('SELECT 1')).rejects.toThrow('Database not connected');
    });
  });

  describe('transaction', () => {
    beforeEach(async () => {
      db = new (DatabaseConnection as any)(dbConfig);
      await db.initialize();
    });

    it('should execute transactions successfully', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: jest.fn(),
      };
      
      const mockPool = (db as any).pool;
      mockPool.connect.mockResolvedValueOnce(mockClient);

      const result = await db.transaction(async (client) => {
        await client.query('INSERT INTO test VALUES (1)');
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on transaction errors', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockRejectedValueOnce(new Error('Transaction failed')) // User query
          .mockResolvedValueOnce(undefined), // ROLLBACK
        release: jest.fn(),
      };
      
      const mockPool = (db as any).pool;
      mockPool.connect.mockResolvedValueOnce(mockClient);

      await expect(db.transaction(async (client) => {
        await client.query('INVALID SQL');
      })).rejects.toThrow('Transaction failed');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      db = new (DatabaseConnection as any)(dbConfig);
      await db.initialize();
    });

    it('should return health status', () => {
      expect(db.isHealthy()).toBe(true);
    });

    it('should return pool statistics', () => {
      const stats = db.getPoolStats();
      expect(stats).toHaveProperty('totalCount');
      expect(stats).toHaveProperty('idleCount');
      expect(stats).toHaveProperty('waitingCount');
    });

    it('should close connections', async () => {
      await expect(db.close()).resolves.not.toThrow();
    });
  });
});