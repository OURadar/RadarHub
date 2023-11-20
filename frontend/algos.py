import numpy as np

#

def passthrough(x, maxgates=4096):
    if x.shape[1] > maxgates:
        x[:, maxgates:] = np.nan
    return x

def unfold(v, va=11.6):
    mask = np.isfinite(v)
    u = np.unwrap(np.nan_to_num(v), period=2*va, axis=-1)
    u[~mask] = np.nan
    return u

def zshift(z, offset=5):
    return z + offset

#
# VUnfold
#

model = None

def to_label(y):
    '''
        Returns the index to get category reordered to:
        0 - Void, masked portion, could be any
        1 - Folded twice in the negative direction
        2 - Folded once in the negative direction
        3 - Unfolded, normal
        4 - Folded once in the positive direction
        5 - Folded twice in the position direction

        Basically (0, 1, 2, 3, 4, 5) -> (V, 4, 2, 1, 3, 5)
    '''

    i = np.array([0, 4, 2, 1, 3, 5])
    return np.argmax(y[..., i], axis=-1)

def vlabel0(values, va=11.57875):
    v = np.nan_to_num(values) / va
    x = np.zeros((16, 256, 128, 1))
    # [0 2 4 ... 358] 180 radials map to the middle of 256
    # [284 286 288 ... 358 0 2 4 ... 358 0 2 4 ... 36] to make up 256 radials
    for k in range(16):
        g = k // 2
        if k % 2 == 0:
            # Even rays
            x[k, 0:38, :, 0] = v[284:360:2, g:1024:8]
            x[k, 38:218, :, 0] = v[0:360:2, g:1024:8]
            x[k, 218:256, :, 0] = v[0:76:2, g:1024:8]
        else:
            # Odd rays
            x[k, 0:38, :, 0] = v[285:360:2, g:1024:8]
            x[k, 38:218, :, 0] = v[1:360:2, g:1024:8]
            x[k, 218:256, :, 0] = v[1:76:2, g:1024:8]

    y = model.predict(x)
    z = to_label(y[:, 38:218, :, :])

    m = np.zeros(v.shape, dtype=np.float32)
    for k in range(16):
        g = k // 2
        if k % 2 == 0:
            # Even rays
            m[0:360:2, g:1024:8] = z[k, :, :]
        else:
            # Odd rays
            m[1:360:2, g:1024:8] = z[k, :, :]
    m[np.isnan(values)] = 0;
    m[:, 1024:] = 0;
    return m

def vlabel(values, va=11.57875, t=128):
    if values.shape[0] != 360:
        return values

    global model

    if model is None:
        from tensorflow import keras

        tiny = keras.backend.epsilon()
        crossentropy_weights = keras.backend.variable([0, 0.2, 1.0, 1.0, 5.0, 5.0])

        def custom_objects():
            '''
                List of custom objects in this module
            '''
            def weighted_crossentropy(y_true, y_pred):
                '''
                    Modified from https://gist.github.com/wassname/ce364fddfc8a025bfab4348cf5de852d
                '''
                y_pred /= keras.backend.sum(y_pred, axis=-1, keepdims=True)
                y_pred = keras.backend.clip(y_pred, tiny, 1.0 - tiny)
                loss = y_true * keras.backend.log(y_pred) * crossentropy_weights
                return -keras.backend.sum(loss, axis=-1)


            def facc(y_true, y_pred):
                '''
                    Categorical accuracy without counting class 0 or class 1
                '''
                t = keras.backend.argmax(y_true, axis=-1)
                p = keras.backend.argmax(y_pred, axis=-1)
                e = keras.backend.equal(t, p)
                return keras.backend.mean(e[t > 1])

            def f0(y_true, y_pred):
                '''
                    Categorical accuracy without counting classes 1 and 2
                '''
                t = keras.backend.argmax(y_true, axis=-1)
                p = keras.backend.argmax(y_pred, axis=-1)
                e = keras.backend.equal(t, p)
                return keras.backend.mean(e[t == 1])

            def f1(y_true, y_pred):
                '''
                    Categorical accuracy without counting classes 0 and 2
                '''
                t = keras.backend.argmax(y_true, axis=-1)
                p = keras.backend.argmax(y_pred, axis=-1)
                e = keras.backend.equal(t, p)
                newe = keras.backend.concatenate((e[t==2],e[t==3]),axis=-1)
                return keras.backend.mean(newe)

            def f2(y_true, y_pred):
                '''
                    Categorical accuracy without counting classes 0 and 1
                '''
                t = keras.backend.argmax(y_true, axis=-1)
                p = keras.backend.argmax(y_pred, axis=-1)
                e = keras.backend.equal(t, p)
                return keras.backend.mean(e[t > 3])

            def acc(y_true, y_pred):
                '''
                    Categorical accuracy without counting class 0
                '''
                t = keras.backend.argmax(y_true, axis=-1)
                p = keras.backend.argmax(y_pred, axis=-1)
                e = keras.backend.equal(t, p)
                return keras.backend.mean(e[t > 0])

            return {
                'f0': f0,
                'f1': f1,
                'f2': f2,
                'acc': acc,
                'macc': acc,
                'facc': facc,
                'fold_acc': facc,
                'weighted_crossentropy': weighted_crossentropy
            }

        if t == 128:
            # U-Net for input size 256 x 128
            model = keras.models.load_model('models/i5w4.h5', custom_objects=custom_objects())
        elif t == 256:
            # U-Net for input size 256 x 256
            model = keras.models.load_model('models/i7.h5', custom_objects=custom_objects())

    v = np.nan_to_num(values) / va

    if t == 128:
        x = np.zeros((16, 256, 128, 1))
        # [0 2 4 ... 358] 180 radials map to the middle of 256
        # [284 286 288 ... 358 0 2 4 ... 358 0 2 4 ... 36] to make up 256 radials
        for k in range(16):
            g = k // 2
            if k % 2 == 0:
                # Even rays
                x[k, 0:38, :, 0] = v[284:360:2, g:1024:8]
                x[k, 38:218, :, 0] = v[0:360:2, g:1024:8]
                x[k, 218:256, :, 0] = v[0:76:2, g:1024:8]
            else:
                # Odd rays
                x[k, 0:38, :, 0] = v[285:360:2, g:1024:8]
                x[k, 38:218, :, 0] = v[1:360:2, g:1024:8]
                x[k, 218:256, :, 0] = v[1:76:2, g:1024:8]
    elif t == 256:
        x = np.zeros((16, 256, 256, 1))
        # [0 2 4 ... 358] 180 radials map to the middle of 256
        # [284 286 288 ... 358 0 2 4 ... 358 0 2 4 ... 36] to make up 256 radials
        for k in range(8):
            g = k // 2
            if k % 2 == 0:
                # Even rays
                x[k, 0:38, :, 0] = v[284:360:2, g:1024:4]
                x[k, 38:218, :, 0] = v[0:360:2, g:1024:4]
                x[k, 218:256, :, 0] = v[0:76:2, g:1024:4]
            else:
                # Odd rays
                x[k, 0:38, :, 0] = v[285:360:2, g:1024:4]
                x[k, 38:218, :, 0] = v[1:360:2, g:1024:4]
                x[k, 218:256, :, 0] = v[1:76:2, g:1024:4]

    y = model.predict(x)
    z = to_label(y[:, 38:218, :, :])

    m = np.zeros(v.shape, dtype=np.float32)
    if t == 128:
        for k in range(16):
            g = k // 2
            if k % 2 == 0:
                # Even rays
                m[0:360:2, g:1024:8] = z[k, :, :]
            else:
                # Odd rays
                m[1:360:2, g:1024:8] = z[k, :, :]
    elif t == 256:
        for k in range(8):
            g = k // 2
            if k % 2 == 0:
                # Even rays
                m[0:360:2, g:1024:4] = z[k, :, :]
            else:
                # Odd rays
                m[1:360:2, g:1024:4] = z[k, :, :]
    m[np.isnan(values)] = 0;
    m[:, 1024:] = 0;
    return m

def vunfold(values, va=11.57875):
    m = vlabel(values, va=va)
    u = (m - 3) * 2.0 * va + values
    u[:, 1024:] = np.nan
    return u

def kdp(p):
    dr = p[:, 1:] - p[:, :-1]
    dr = np.concatenate((0, dr), axis=-1)
    dr[dr < 0] = 0
    return dr
