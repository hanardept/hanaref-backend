const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

describe('hanaref-backend API', () => {
  test('GET /items returns an array', async () => {
    const response = await axios.get(`${API_BASE_URL}/items`);
    expect(Array.isArray(response.data)).toBe(true);
  });
});