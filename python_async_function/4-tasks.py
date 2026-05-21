#!/usr/bin/env python3
'''Module for the task'''
import asyncio
from typing import List

wait_random = __import__('3-tasks').task_wait_random


async def task_wait_n(n: int, max_delay: int) -> List[float]:
    '''Return the time of the execution of wait_n'''
    tasks = [wait_random(max_delay) for _ in range(n)]
    delays = await asyncio.gather(*tasks)
    return sorted(delays)
