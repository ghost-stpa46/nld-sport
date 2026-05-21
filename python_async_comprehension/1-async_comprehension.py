#!/usr/bin/env python3
"""Async comprehension"""
import asyncio
from typing import List

async_generator = __import__('0-async_generator').async_generator


async def async_comprehension() -> List[float]:
    """Collect 10 random numbers using an async comprehensing"""
    return [i async for i in async_generator()]

if __name__ == "__main__":
    asyncio.run(async_comprehension())
