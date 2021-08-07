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
