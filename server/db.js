const path = require('path');
const fs = require('fs');
const Datastore = require('nedb-promises');
const { MongoClient } = require('mongodb');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let useMongo = false;
let mongoDbInstance = null;

const collectionNames = [
  'users',
  'departments',
  'doctors',
  'schedules',
  'patients',
  'appointments',
  'tokens',
  'audit_log',
  'security_events'
];

const nedbCollections = {};
collectionNames.forEach(name => {
  nedbCollections[name] = Datastore.create({
    filename: path.join(dataDir, `${name}.db`),
    autoload: true
  });
});

// Generic wrapper providing MongoDB-like query interface
function createCollectionWrapper(name) {
  const nedb = nedbCollections[name];

  return {
    async find(query = {}, options = {}) {
      if (useMongo && mongoDbInstance) {
        let cursor = mongoDbInstance.collection(name).find(query);
        if (options.sort) cursor = cursor.sort(options.sort);
        if (options.limit) cursor = cursor.limit(options.limit);
        if (options.skip) cursor = cursor.skip(options.skip);
        return await cursor.toArray();
      }

      let cursor = nedb.find(query);
      if (options.sort) cursor = cursor.sort(options.sort);
      if (options.limit) cursor = cursor.limit(options.limit);
      if (options.skip) cursor = cursor.skip(options.skip);
      return await cursor.exec();
    },

    async findOne(query = {}) {
      if (useMongo && mongoDbInstance) {
        return await mongoDbInstance.collection(name).findOne(query);
      }
      return await nedb.findOne(query);
    },

    async insertOne(doc) {
      const toInsert = { ...doc };
      if (!toInsert.createdAt && !toInsert.created_at) {
        toInsert.created_at = Date.now();
      }
      if (useMongo && mongoDbInstance) {
        const res = await mongoDbInstance.collection(name).insertOne(toInsert);
        return { ...toInsert, _id: res.insertedId };
      }
      return await nedb.insert(toInsert);
    },

    async insertMany(docs) {
      if (!Array.isArray(docs) || docs.length === 0) return [];
      const timestamped = docs.map(d => ({
        ...d,
        created_at: d.created_at || Date.now()
      }));
      if (useMongo && mongoDbInstance) {
        const res = await mongoDbInstance.collection(name).insertMany(timestamped);
        return timestamped.map((d, i) => ({ ...d, _id: res.insertedIds[i] }));
      }
      return await nedb.insert(timestamped);
    },

    async updateOne(query, update, options = {}) {
      if (useMongo && mongoDbInstance) {
        return await mongoDbInstance.collection(name).updateOne(query, update, options);
      }
      return await nedb.update(query, update, { multi: false, upsert: options.upsert || false });
    },

    async updateMany(query, update, options = {}) {
      if (useMongo && mongoDbInstance) {
        return await mongoDbInstance.collection(name).updateMany(query, update, options);
      }
      return await nedb.update(query, update, { multi: true, upsert: options.upsert || false });
    },

    async deleteOne(query) {
      if (useMongo && mongoDbInstance) {
        return await mongoDbInstance.collection(name).deleteOne(query);
      }
      return await nedb.remove(query, { multi: false });
    },

    async deleteMany(query = {}) {
      if (useMongo && mongoDbInstance) {
        return await mongoDbInstance.collection(name).deleteMany(query);
      }
      return await nedb.remove(query, { multi: true });
    },

    async countDocuments(query = {}) {
      if (useMongo && mongoDbInstance) {
        return await mongoDbInstance.collection(name).countDocuments(query);
      }
      return await nedb.count(query);
    }
  };
}

const db = {};
collectionNames.forEach(name => {
  db[name] = createCollectionWrapper(name);
});

// Initialization routine to connect to MongoDB if configured, or fall back to embedded JS datastore
async function initDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/queueseva';
  try {
    const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 1500 });
    await client.connect();
    mongoDbInstance = client.db();
    useMongo = true;
    console.log(`[Database] Connected to external MongoDB at ${mongoUri}`);
  } catch (err) {
    useMongo = false;
    console.log(`[Database] Operating in embedded MongoDB/JS datastore mode (persisted to ./data/*.db)`);
  }
}

module.exports = {
  db,
  initDatabase,
  isMongo: () => useMongo
};
