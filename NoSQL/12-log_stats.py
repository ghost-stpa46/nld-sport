#!/usr/bin/env python3
"""Provides some stats about Nginx logs stored in MongoDB."""

from pymongo import MongoClient

def log_stats():
    """Displays stats about Nginx logs stored in MongoDB."""
    client = MongoClient()
    db = client.logs
    collection = db.nginx

    total_logs = collection.count_documents({})
    print(f"{total_logs} logs")

    print("Methods:")
    methods = ["GET", "POST", "PUT", "PATCH", "DELETE"]
    for method in methods:
        count = collection.count_documents({"method": method})
        print(f"\tmethod {method}: {count}")

    status_checks = collection.count_documents({"method": "GET", "path": "/status"})
    print(f"{status_checks} status check")


if __name__ == "__main__":
    log_stats()
