#!/usr/bin/env python3
'''Module for measuring the runtime of a coroutine'''
import asyncio
import time
import random
import importlib
wait_n = importlib.import_module('1-concurrent_coroutines').wait_n


def measure_time(n: int, max_delay: int) -> float:
    '''Measures the runtime of a coroutine'''
    start = time.time()
    asyncio.run(wait_n(n, max_delay))
    end = time.time()
    return (end - start) / n
