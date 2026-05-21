#!/usr/bin/env python3
'''Module for sum_mixed_list function'''
from typing import Union, List


def sum_mixed_list(mxd_lst: List[Union[int, float]]) -> float:
    '''Sum a list of floats and integers and return the result'''
    return sum(mxd_lst)
