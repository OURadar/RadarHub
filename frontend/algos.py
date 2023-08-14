import numpy as np
import tensorflow as tf

def passthrough(x):
    return x

def unfold(v, va=11.6):
    mask = np.isfinite(v)
    u = np.unwrap(np.nan_to_num(v), period=2*va, axis=-1)
    u[~mask] = np.nan
    return u
