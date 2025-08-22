import axios from 'axios';
import { init as initDb, close as closeDb } from './mongo';
import { data as itemsData } from './data/items.js';
import mockServer from 'mockserver-client';

describe('hanaref-backend API', () => {
  beforeAll(async () => {
    await initDb();

    mockServer.mockServerClient('localhost', 1090)
      .mockAnyResponse({
        httpRequest: {
          method: 'GET',
          path: '/.well-known/jwks.json'
        },
        httpResponse: {
          statusCode: 200,
          headers: [
            { name: 'Content-Type', values: ['application/json'] }
          ],
          body: JSON.stringify({ keys: [
            {
              kty: "RSA",
              kid: "test-key-id",
              use: "sig",
              alg: "RS256",
              n: "your-modulus",
              e: "AQAB"
            }
          ] })
        }
      })
      .then(response => console.log(response));    
  });

  afterAll(async () => {
    await closeDb();
  })

  function generateToken() {
    const jwt = require('jsonwebtoken');
    const privateKey = `-----BEGIN RSA PRIVATE KEY-----
    somekey
    -----END RSA PRIVATE KEY-----`;

    const token = jwt.sign(
      {
        // your claims
        'https://your-namespace/roles': ['admin'],
        'https://your-namespace/user_id': 'abcd'
      },
      privateKey,
      {
        algorithm: 'RS256',
        keyid: 'test-key-id', // must match JWKS
        issuer: 'https://mockServer:1090/',
        audience: 'http://localhost:5000',
        expiresIn: '1h'
      }
    );
  }

  function compareWithExpectedItems(items, expectedItems, expectedLength) {
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(Math.min(expectedLength, expectedItems.length));
    for (const item of items) {
      const expectedItem = expectedItems.find(i => i.cat === item.cat);
      expect(expectedItem).toBeDefined();

      const fields = ["cat", "imageLink", "name", "archived"];
      expect(Object.keys(item).length).toEqual([ ...Object.keys(item).filter(key => fields.includes(key)), "_id"].length);
      for (const field of fields) {
        expect(item[field]).toEqual(expectedItem[field]);
      }
      expect(item._id).toBeDefined();
    }    
  }

  test('GET /items returns an array', async () => {
    const response = await axios.get(`${process.env.API_BASE_URL}/items`, { headers: { 'auth-token': generateToken() } });
    compareWithExpectedItems(response.data, itemsData, 20);
  });

  test('GET /items with sector filter returns an array with only sector items', async () => {
    const response = await axios.get(`${process.env.API_BASE_URL}/items?sector=ביו-הנדסה (מכשור רפואת שגרה)`, { headers: { 'auth-token': generateToken() } });
    compareWithExpectedItems(response.data, itemsData.filter(i => i.sector === "ביו-הנדסה (מכשור רפואת שגרה)" && !i.archived), 20);
  });

  test('GET /items with sector & departement filters returns an array with only sector + department items', async () => {
    const response = await axios.get(`${process.env.API_BASE_URL}/items?sector=ביו-הנדסה (מכשור רפואת שגרה)&department=אודיולוגיה`, { headers: { 'auth-token': generateToken() } });
    compareWithExpectedItems(response.data, itemsData.filter(i => i.sector === "ביו-הנדסה (מכשור רפואת שגרה)" && i.department === "אודיולוגיה" && !i.archived), 20);
  });

  test('GET /items with sector, departement & search filters returns an array with only sector + department + search items', async () => {
    const params = new URLSearchParams({
      sector: "ביו-הנדסה (מכשור רפואת שגרה)",
      department: "אודיולוגיה",
      search: "אוזניות"
    })
    const url = `${process.env.API_BASE_URL}/items?${params.toString()}`;
    const response = await axios.get(url, { headers: { 'auth-token': generateToken() } });
    compareWithExpectedItems(response.data, itemsData.filter(i => i.sector === "ביו-הנדסה (מכשור רפואת שגרה)" && i.department === "אודיולוגיה" && i.name.includes("אוזניות") && !i.archived), 20);
  });

  test('GET /items multiple pages with sector, departement & search filters returns an array with only sector + department + search items', async () => {
    const params = new URLSearchParams({
      sector: "ביו-הנדסה (מכשור רפואת שגרה)",
      department: "אודיולוגיה",
      search: "אוזניות",
      page: 0
    })
    let url = `${process.env.API_BASE_URL}/items?${params.toString()}`;
    const response1 = await axios.get(url, { headers: { 'auth-token': generateToken() } });
    compareWithExpectedItems(response1.data, itemsData.filter(i => i.sector === "ביו-הנדסה (מכשור רפואת שגרה)" && i.department === "אודיולוגיה" && i.name.includes("אוזניות") && !i.archived), 20);

    // Get next page and verify items are returned and they are different than the first page
    params.set('page', 1);
    url = `${process.env.API_BASE_URL}/items?${params.toString()}`;
    const response2 = await axios.get(url, { headers: { 'auth-token': generateToken() } });
    compareWithExpectedItems(response2.data, itemsData.filter(i => 
      i.sector === "ביו-הנדסה (מכשור רפואת שגרה)" &&
      i.department === "אודיולוגיה" &&
      i.name.includes("אוזניות")
      && !i.archived
      && !response1.data.find(d => d.cat === i.cat)), 20);
  });

    test('GET /items with sector, departement & search filters including archived returns an array with only sector + department + search items', async () => {
    const params = new URLSearchParams({
      sector: "ביו-הנדסה (מכשור רפואת שגרה)",
      department: "אודיולוגיה",
      search: "אוזניות",
      status: "all"
    })
    const url = `${process.env.API_BASE_URL}/items?${params.toString()}`;
    const response = await axios.get(url, { headers: { 'auth-token': generateToken() } });
    compareWithExpectedItems(response.data, itemsData.filter(i => i.sector === "ביו-הנדסה (מכשור רפואת שגרה)" && i.department === "אודיולוגיה" && i.name.includes("אוזניות")), 20);
  });
});