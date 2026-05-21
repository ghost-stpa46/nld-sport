#!/usr/bin/env python3
'''Measure runtime'''
import asyncio
import time
from typing import List

async_comprehension = __import__('1-async_comprehension').async_comprehension


async def measure_runtime() -> float:
    '''Measure runtime'''
    start = time.time()
    await asyncio.gather(*(async_comprehension() for _ in range(4)))
    return time.time() - start


if __name__ == '__main__':
    print(asyncio.run(measure_runtime()))
