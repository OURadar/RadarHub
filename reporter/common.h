#ifndef __radarhub_common__
#define __radarhub_common__

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <unistd.h>

#pragma pack(push, 1)

typedef union {
    struct {
        uint16_t m:10;        // mantissa (mask 0x3FF)
        int8_t   e:5;         // exponent 2 ** 4 - 1 = 15 (mask 0x1F)
        uint8_t  s:1;         // sign bit
    };
    uint8_t bytes[2];         // raw bytes
    uint16_t u16;             // 16-bit
} half_float_t;

typedef union {
    struct {
        uint32_t m:23;        // mantissa (mask 0x7FFFFF)
        int8_t   e:8;         // exponent  2 ** 7 - 1 = 127 (mask 0xFF)
        uint8_t  s:1;         // sign bit
    };
    uint8_t bytes[4];         // raw bytes
    uint32_t u32;             // 32-bit
    float f32;
} single_float_t;

typedef union {
    struct {
        uint64_t m:52;        // mantissa (mask 0xFFFFFFFFFFFFF)
        int16_t  e:11;        // exponent 2 ** 10 - 1 = 1023 (mask 0x3FF)
        uint8_t  s:1;         // sign bit
    };
    uint8_t bytes[8];         // raw bytes
    uint64_t u64;             // 64-bit
    double f64;
} double_float_t;

#pragma pack(pop)

char *binaryString(char *dst, void *src, size_t);
void headTailBinaryString(char *dst, void *src, size_t);

double_float_t single2double(single_float_t s);
single_float_t half2single(half_float_t s);

#endif
