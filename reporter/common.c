#include <common.h>

char *binaryString(char *dst, void *src, size_t count) {
    uint8_t *c = (uint8_t *)src;
    *dst++ = 'b';
    *dst++ = '\'';
    for (int i = 0; i < count; i++) {
        if (*c >= 32 && *c < 127) {
            if (*c == '\\' || *c == '\'') {
                *dst++ = '\\';
            }
            *dst++ = *c++;
        } else {
            dst += sprintf(dst, "\\x%02x", *c++);
        }
    }
    *dst++ = '\'';
    *dst = '\0';
    return dst;
}

void headTailBinaryString(char *dst, void *src, size_t count) {
    char *tail = binaryString(dst, src, 25);
    binaryString(tail + sprintf(tail, " ... "), src + count - 5, 5);
}

//
// Inspired by https://github.com/ramenhut/half
//

double_float_t single2double(single_float_t s) {
    double_float_t d;
    d.s = s.s;
    d.e = s.e == 0 ? 0 : (((int16_t)s.e - 127) & 0x7FF) + 1023;
    d.m = (uint64_t)s.m << 29;
    return d;
}

single_float_t half2single(half_float_t s) {
    single_float_t d;
    d.s = s.s;
    d.e = s.e == 0 ? 0 : (((int8_t)s.e - 15) & 0xFF) + 127;
    d.m = (uint16_t)s.m << 13;
    return d;
}
