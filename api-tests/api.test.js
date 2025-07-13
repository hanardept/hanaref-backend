const axios = require('axios');
import { init as initDb } from 'mongo';
import { data as itemsData } from './data/items.js';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

describe('hanaref-backend API', () => {
  beforeAll(async () => {
    initDb();
  });

  test('GET /items returns an array', async () => {
    const response = await axios.get(`${API_BASE_URL}/items`);
    expect(Array.isArray(response.data)).toBe(true);
    expect(Array.length(response.data)).toBe(itemsData.length);
  });
});