import axios from 'axios';
import { init as initDb, close as closeDb } from './mongo';
import { data as itemsData } from './data/items.js';
import mockServer from 'mockserver-client';
import jwt from 'jsonwebtoken';
//import { generateKeyPair } from 'jose/util/generate_key_pair';
import * as jose from 'jose'


let token;

describe('hanaref-backend API', () => {
  beforeAll(async () => {
    await initDb();

    token = await generateToken();

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

  async function generateToken() {
      const { privateKey, publicKey } = await jose.generateKeyPair('RS256');


      // console.log(privateKey.export({ format: 'pem', type: 'pkcs1' }));
      // console.log(publicKey.export({ format: 'pem', type: 'spki' }));
    // const privateKey = `
    // -----BEGIN RSA PRIVATE KEY-----
    // MIIBOgIBAAJBALwQbQKXwQwK9vZkQwQbQKXwQwK9vZkQwQbQKXwQwK9vZkQwQbQK
    // XwQwK9vZkQwQbQKXwQwK9vZkQwQbQKXwQwK9vZkQwQbQKXwIDAQABAkA1QwQbQK
    // XwQwK9vZkQwQbQKXwQwK9vZkQwQbQKXwQwK9vZkQwQbQKXwQwK9vZkQwQbQKXwQ
    // wK9vZkQwQbQKXwQwK9vZkQwQbQKXwAiEA8wQbQKXwQwK9vZkQwQbQKXwQwK9vZk
    // QwQbQKXwQwK9vZkCIQDLQwQbQKXwQwK9vZkQwQbQKXwQwK9vZkQwQbQKXwQwK9v
    // ZkIhAPwQbQKXwQwK9vZkQwQbQKXwQwK9vZkQwQbQKXwQwK9vZkAiEA8wQbQKXw
    // QwK9vZkQwQbQKXwQwK9vZkQwQbQKXwQwK9vZk=
    // -----END RSA PRIVATE KEY-----
    // `;

    token = new jose.SignJWT({
      'www.hanaref-test.com/roles': ['admin'],
      'www.hanaref-test.com/user_id': 'abcd'
    })
    .setProtectedHeader({ alg: 'HS256', kid: 'test-key-id' })
    .setAudience('http://localhost:5000')
    .setExpirationTime('1h')
    .setIssuer('https://mockServer:1090/')

    return token.sign(privateKey);
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
    const response = await axios.get(`${process.env.API_BASE_URL}/items`, { headers: { 'auth-token': token } });
    compareWithExpectedItems(response.data, itemsData, 20);
  });

  test('GET /items with sector filter returns an array with only sector items', async () => {
    const response = await axios.get(`${process.env.API_BASE_URL}/items?sector=ביו-הנדסה (מכשור רפואת שגרה)`, { headers: { 'auth-token': token } });
    compareWithExpectedItems(response.data, itemsData.filter(i => i.sector === "ביו-הנדסה (מכשור רפואת שגרה)" && !i.archived), 20);
  });

  test('GET /items with sector & departement filters returns an array with only sector + department items', async () => {
    const response = await axios.get(`${process.env.API_BASE_URL}/items?sector=ביו-הנדסה (מכשור רפואת שגרה)&department=אודיולוגיה`, { headers: { 'auth-token': token } });
    compareWithExpectedItems(response.data, itemsData.filter(i => i.sector === "ביו-הנדסה (מכשור רפואת שגרה)" && i.department === "אודיולוגיה" && !i.archived), 20);
  });

  test('GET /items with sector, departement & search filters returns an array with only sector + department + search items', async () => {
    const params = new URLSearchParams({
      sector: "ביו-הנדסה (מכשור רפואת שגרה)",
      department: "אודיולוגיה",
      search: "אוזניות"
    })
    const url = `${process.env.API_BASE_URL}/items?${params.toString()}`;
    const response = await axios.get(url, { headers: { 'auth-token': token } });
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
    const response1 = await axios.get(url, { headers: { 'auth-token': token } });
    compareWithExpectedItems(response1.data, itemsData.filter(i => i.sector === "ביו-הנדסה (מכשור רפואת שגרה)" && i.department === "אודיולוגיה" && i.name.includes("אוזניות") && !i.archived), 20);

    // Get next page and verify items are returned and they are different than the first page
    params.set('page', 1);
    url = `${process.env.API_BASE_URL}/items?${params.toString()}`;
    const response2 = await axios.get(url, { headers: { 'auth-token': token } });
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
    const response = await axios.get(url, { headers: { 'auth-token': token } });
    compareWithExpectedItems(response.data, itemsData.filter(i => i.sector === "ביו-הנדסה (מכשור רפואת שגרה)" && i.department === "אודיולוגיה" && i.name.includes("אוזניות")), 20);
  });
});