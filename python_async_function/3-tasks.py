#!/usr/bin/env python3
'''Module for the tasks'''
import asyncio
import importlib
wait_random = importlib.import_module('0-basic_async_syntax').wait_random


def task_wait_random(max_delay: int) -> asyncio.Task:
    '''Return a asyncio.Task'''
    return asyncio.create_task(wait_random(max_delay))
