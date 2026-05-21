#!/usr/bin/env python3
'''Module for element_length function'''
from typing import Iterable, Sequence, Tuple, List


def element_length(lst: Iterable[Sequence]) -> List[Tuple[Sequence, int]]:
    '''Returns a list of tuples, each with a sequence and its length'''
    return [(i, len(i)) for i in lst]
