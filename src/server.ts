import { joinRoom } from 'trystero';
import { RTCPeerConnection } from 'node-datachannel/polyfill';
import crypto from 'crypto';
import level from 'level';

// Create or open a LevelDB database
const db = level('./indexeddbstore', { valueEncoding: 'json' });

// Define the structure of a record
interface Record {
  mapid: string;
  timestamp: string;
  title: string;
  text: string;
  link: string;
  longitude: string;
  latitude: string;
  category: string;
}

let recordCache: Record[] = [];
const MAX_CACHE_SIZE = 10000;

// Create an empty record
function createEmptyRecord(): Record {
  return {
    mapid: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    title: '',
    text: '',
    link: '',
    longitude: '',
    latitude: '',
    category: 'brainstorming',
  };
}

// Function to hash data using SHA-256
function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Function to fetch client data
async function fetchClientData(): Promise<{ id: number; username: string; appid: string }> {
  try {
    const client = await db.get('client');
    console.log('Fetched client data:', client);
    return client;
  } catch (err: any) {
    if (err.notFound) {
      console.warn('Client data not found, creating new...');
      const usernameRandom = crypto.randomUUID();
      const salt = 'salt1234';
      const appid = hashData(usernameRandom + salt);
      const client = { id: 1, username: usernameRandom, appid };
      await db.put('client', client);
      console.log('Created new client data:', client);
      return client;
    }
    throw err;
  }
}

// Function to load records
async function loadRecords(): Promise<Record[]> {
  const records: Record[] = [];
  for await (const [key, value] of db.iterator({ gt: 'locationpins:', lt: 'locationpins:~' })) {
    records.push(value as Record);
  }
  return records;
}

// Function to store a record
async function storeRecord(record: Record): Promise<void> {
  await db.put(`locationpins:${record.mapid}`, record);
  console.log('Stored record:', record);
}

// Function to delete old records
async function deleteOldRecords(storePrefix: string): Promise<void> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days ago
  const batch = db.batch();
  for await (const [key, value] of db.iterator({ gt: `${storePrefix}:`, lt: `${storePrefix}:~` })) {
    if (new Date((value as Record).timestamp) < cutoff) {
      batch.del(key);
      console.log('Deleted old record:', key);
    }
  }
  await batch.write();
}

// Trystero setup
const trysteroroomname = process.env.TRYSTERO_ROOM_NAME || 'default-room';
const room = joinRoom({ appId: 'username', rtcPolyfill: RTCPeerConnection }, trysteroroomname);

// Start room and handle peer events
function startRoom(): void {
  room.onPeerJoin(peerId => {
    sendCache(recordCache);
    console.log(`Peer ${peerId} joined`);
  });

  room.onPeerLeave(peerId => {
    console.log(`Peer ${peerId} left`);
  });

  const [sendRecordAction, getRecord] = room.makeAction<Record>('record');
  getRecord(async (data, peerId) => {
    if (!recordCache.some(rec => rec.mapid === data.mapid)) {
      recordCache.push(data);
      if (recordCache.length > MAX_CACHE_SIZE) recordCache.shift();
      await storeRecord(data);
      console.log(`Received record from peer ${peerId} and stored`);
    }
  });

  const [sendCache, getCache] = room.makeAction<Record[]>('cache');
  getCache(async data => {
    const newRecords = data.filter(rec => !recordCache.some(rc => rc.mapid === rec.mapid));
    recordCache.push(...newRecords);
    if (recordCache.length > MAX_CACHE_SIZE) recordCache.splice(0, recordCache.length - MAX_CACHE_SIZE);
    for (const record of newRecords) {
      await storeRecord(record);
    }
    console.log('Stored received cache');
  });
}

// Main function to initialize server
async function main(): Promise<void> {
  console.log('Initializing server...');
  await deleteOldRecords('locationpins');
  await deleteOldRecords('localpins');

  const client = await fetchClientData();
  console.log('Client data:', client);

  recordCache = await loadRecords();
  console.log('Loaded records:', recordCache);

  startRoom();
}

main().catch(err => {
  console.error('Error initializing server:', err);
});