import axios from 'axios';
import { init as initDb, close as closeDb } from './mongo';
import { data as itemsData } from './data/items.js';

describe('hanaref-backend API', () => {
  beforeAll(async () => {
    await initDb();
  });

  afterAll(async () => {
    await closeDb();
  })

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
    const response = await axios.get(`${process.env.API_BASE_URL}/items`);
    compareWithExpectedItems(response.data, itemsData, 20);
  });

  test('GET /items with sector filter returns an array with only sector items', async () => {
    const response = await axios.get(`${process.env.API_BASE_URL}/items?sector=ביו-הנדסה (מכשור רפואת שגרה)`);
    compareWithExpectedItems(response.data, itemsData.filter(i => i.sector === "ביו-הנדסה (מכשור רפואת שגרה)" && !i.archived), 20);
  });

  test('GET /items with sector & departement filters returns an array with only sector + department items', async () => {
    const response = await axios.get(`${process.env.API_BASE_URL}/items?sector=ביו-הנדסה (מכשור רפואת שגרה)&department=אודיולוגיה`);
    compareWithExpectedItems(response.data, itemsData.filter(i => i.sector === "ביו-הנדסה (מכשור רפואת שגרה)" && i.department === "אודיולוגיה" && !i.archived), 20);
  });

  test('GET /items with sector, departement & search filters returns an array with only sector + department + search items', async () => {
    const params = new URLSearchParams({
      sector: "ביו-הנדסה (מכשור רפואת שגרה)",
      department: "אודיולוגיה",
      search: "אוזניות"
    })
    const url = `${process.env.API_BASE_URL}/items?${params.toString()}`;
    const response = await axios.get(url);
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
    const response1 = await axios.get(url);
    compareWithExpectedItems(response1.data, itemsData.filter(i => i.sector === "ביו-הנדסה (מכשור רפואת שגרה)" && i.department === "אודיולוגיה" && i.name.includes("אוזניות") && !i.archived), 20);

    // Get next page and verify items are returned and they are different than the first page
    params.set('page', 1);
    url = `${process.env.API_BASE_URL}/items?${params.toString()}`;
    const response2 = await axios.get(url);
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
    const response = await axios.get(url);
    compareWithExpectedItems(response.data, itemsData.filter(i => i.sector === "ביו-הנדסה (מכשור רפואת שגרה)" && i.department === "אודיולוגיה" && i.name.includes("אוזניות")), 20);
  });
});