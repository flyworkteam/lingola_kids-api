const assert = require('node:assert/strict');
const test = require('node:test');

const databasePath = require.resolve('../config/database');
const authControllerPath = require.resolve('../controllers/authController');

const loadController = (connection) => {
  delete require.cache[require.resolve('../controllers/userController')];
  require.cache[databasePath] = {
    exports: {
      pool: {
        getConnection: async () => connection,
        execute: async () => {
          throw new Error('Unexpected pool.execute call');
        }
      }
    }
  };
  require.cache[authControllerPath] = {
    exports: {
      userResponse: (user) => user
    }
  };

  return require('../controllers/userController');
};

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  }
});

test('savePreferences grants 2 days of premium on first onboarding completion', async () => {
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push({ type: 'begin' }),
    commit: async () => calls.push({ type: 'commit' }),
    rollback: async () => calls.push({ type: 'rollback' }),
    release: () => calls.push({ type: 'release' }),
    execute: async (sql, params) => {
      calls.push({ type: 'execute', sql, params });

      if (/SELECT onboarding_completed/.test(sql)) {
        return [[{ onboarding_completed: 0, premium_endtime: null }]];
      }

      if (/UPDATE users SET/.test(sql)) {
        return [{ affectedRows: 1 }];
      }

      if (/DELETE FROM user_preferred_categories/.test(sql)) {
        return [{ affectedRows: 0 }];
      }

      return [{ affectedRows: 1 }];
    }
  };

  const { savePreferences } = loadController(connection);
  const res = createResponse();

  await savePreferences(
    {
      user: { id: 42 },
      body: {
        preferred_language: 'en',
        full_name: 'Ada',
        preferred_categories: ['numbers']
      }
    },
    res,
    (error) => {
      throw error;
    }
  );

  const updateCall = calls.find((call) => /UPDATE users SET/.test(call.sql || ''));
  assert.match(updateCall.sql, /is_premium = \?/);
  assert.match(updateCall.sql, /premium_endtime = \?/);

  const premiumEndTime = updateCall.params[updateCall.params.length - 2];
  const expectedEndTime = Date.now() + 2 * 24 * 60 * 60 * 1000;
  assert.ok(premiumEndTime instanceof Date);
  assert.ok(Math.abs(premiumEndTime.getTime() - expectedEndTime) < 5000);
  assert.equal(res.body.data.premiumGranted, true);
});

test('savePreferences does not grant welcome premium after onboarding was already completed', async () => {
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push({ type: 'begin' }),
    commit: async () => calls.push({ type: 'commit' }),
    rollback: async () => calls.push({ type: 'rollback' }),
    release: () => calls.push({ type: 'release' }),
    execute: async (sql, params) => {
      calls.push({ type: 'execute', sql, params });

      if (/SELECT onboarding_completed/.test(sql)) {
        return [[{ onboarding_completed: 1, premium_endtime: new Date('2026-05-01T00:00:00Z') }]];
      }

      if (/UPDATE users SET/.test(sql)) {
        return [{ affectedRows: 1 }];
      }

      if (/DELETE FROM user_preferred_categories/.test(sql)) {
        return [{ affectedRows: 0 }];
      }

      return [{ affectedRows: 1 }];
    }
  };

  const { savePreferences } = loadController(connection);
  const res = createResponse();

  await savePreferences(
    {
      user: { id: 42 },
      body: {
        preferred_language: 'en',
        full_name: 'Ada'
      }
    },
    res,
    (error) => {
      throw error;
    }
  );

  const updateCall = calls.find((call) => /UPDATE users SET/.test(call.sql || ''));
  assert.doesNotMatch(updateCall.sql, /is_premium = \?/);
  assert.doesNotMatch(updateCall.sql, /premium_endtime = \?/);
  assert.equal(res.body.data.premiumGranted, false);
  assert.equal(res.body.data.premiumEndTime, null);
});
