"""
Database Adapter for QueueSeva
Supports MongoDB via PyMongo with auto-fallback to persistent JSON datastore
if a standalone MongoDB daemon is not running on the local host.
"""

import os
import json
import logging
from datetime import datetime
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("QueueSeva.DB")

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/queueseva")
DB_NAME = os.environ.get("MONGO_DB_NAME", "queueseva")
FALLBACK_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data_store.json")

class MockCollection:
    def __init__(self, name, parent_db):
        self.name = name
        self.parent_db = parent_db

    def _get_data(self):
        return self.parent_db._read_store().setdefault(self.name, [])

    def _save_data(self, data):
        store = self.parent_db._read_store()
        store[self.name] = data
        self.parent_db._write_store(store)

    def find(self, query=None, projection=None):
        data = self._get_data()
        results = []
        for item in data:
            if self._matches(item, query or {}):
                res = dict(item)
                if projection and "_id" not in projection and projection.get("_id") == 0:
                    res.pop("_id", None)
                results.append(res)
        return results

    def find_one(self, query=None, projection=None):
        results = self.find(query, projection)
        return results[0] if results else None

    def insert_one(self, document):
        data = self._get_data()
        doc = dict(document)
        if "_id" not in doc:
            import uuid
            doc["_id"] = str(uuid.uuid4())
        data.append(doc)
        self._save_data(data)
        class InsertResult:
            inserted_id = doc["_id"]
        return InsertResult()

    def insert_many(self, documents):
        data = self._get_data()
        import uuid
        inserted_ids = []
        for d in documents:
            doc = dict(d)
            if "_id" not in doc:
                doc["_id"] = str(uuid.uuid4())
            data.append(doc)
            inserted_ids.append(doc["_id"])
        self._save_data(data)
        class InsertManyResult:
            pass
        res = InsertManyResult()
        res.inserted_ids = inserted_ids
        return res

    def update_one(self, query, update, upsert=False):
        data = self._get_data()
        modified = 0
        matched = 0
        for i, item in enumerate(data):
            if self._matches(item, query):
                matched = 1
                new_item = dict(item)
                if "$set" in update:
                    new_item.update(update["$set"])
                if "$inc" in update:
                    for k, v in update["$inc"].items():
                        new_item[k] = new_item.get(k, 0) + v
                data[i] = new_item
                modified = 1
                self._save_data(data)
                break
        if matched == 0 and upsert:
            doc = dict(query)
            if "$set" in update:
                doc.update(update["$set"])
            if "_id" not in doc:
                import uuid
                doc["_id"] = str(uuid.uuid4())
            data.append(doc)
            self._save_data(data)
            modified = 1
        class UpdateResult:
            matched_count = matched
            modified_count = modified
        return UpdateResult()

    def update_many(self, query, update):
        data = self._get_data()
        modified = 0
        for i, item in enumerate(data):
            if self._matches(item, query):
                new_item = dict(item)
                if "$set" in update:
                    new_item.update(update["$set"])
                if "$inc" in update:
                    for k, v in update["$inc"].items():
                        new_item[k] = new_item.get(k, 0) + v
                data[i] = new_item
                modified += 1
        if modified > 0:
            self._save_data(data)
        class UpdateManyResult:
            modified_count = modified
        return UpdateManyResult()

    def delete_one(self, query):
        data = self._get_data()
        for i, item in enumerate(data):
            if self._matches(item, query):
                data.pop(i)
                self._save_data(data)
                class DeleteResult:
                    deleted_count = 1
                return DeleteResult()
        class DeleteResult:
            deleted_count = 0
        return DeleteResult()

    def count_documents(self, query=None):
        return len(self.find(query or {}))

    def _matches(self, item, query):
        for k, v in query.items():
            if k == "$or" and isinstance(v, list):
                if not any(self._matches(item, cond) for cond in v):
                    return False
            elif isinstance(v, dict):
                # Simple operator support
                val = item.get(k)
                if "$in" in v and val not in v["$in"]:
                    return False
                if "$gte" in v and (val is None or val < v["$gte"]):
                    return False
                if "$lte" in v and (val is None or val > v["$lte"]):
                    return False
                if "$ne" in v and val == v["$ne"]:
                    return False
            else:
                if item.get(k) != v:
                    return False
        return True


class FallbackDatabase:
    def __init__(self, filepath):
        self.filepath = filepath
        if not os.path.exists(self.filepath):
            with open(self.filepath, "w") as f:
                json.dump({}, f)

    def _read_store(self):
        try:
            with open(self.filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _write_store(self, data):
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)

    def __getitem__(self, name):
        return MockCollection(name, self)

    def list_collection_names(self):
        return list(self._read_store().keys())


class DatabaseManager:
    def __init__(self):
        self.is_native_mongo = False
        self.client = None
        self.db = None
        self._connect()

    def _connect(self):
        try:
            # Attempt native MongoDB connection with short timeout
            client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=1500)
            client.admin.command('ping')
            self.client = client
            self.db = client[DB_NAME]
            self.is_native_mongo = True
            logger.info(f"Connected to Native MongoDB at {MONGO_URI}")
        except Exception as e:
            logger.warning(f"Native MongoDB unavailable ({e}). Using embedded fallback JSON store at {FALLBACK_FILE}")
            self.is_native_mongo = False
            self.db = FallbackDatabase(FALLBACK_FILE)

    def get_collection(self, name):
        return self.db[name]

    def is_connected(self):
        return self.is_native_mongo

db_manager = DatabaseManager()

def get_db():
    return db_manager.db

def get_collection(name):
    return db_manager.get_collection(name)
