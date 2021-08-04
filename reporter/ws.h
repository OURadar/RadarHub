//
//  ws.h
//  RadarHub
//
//  Description of the frame header using the official 
//  websocket document RFC6455, which can be found at
//  https://datatracker.ietf.org/doc/html/rfc6455
//
//  Created by Boonleng Cheong on 8/3/2021.
//  Copyright (c) 2021 Boonleng Cheong. All rights reserved.
//

#ifndef __rfc_6455__
#define __rfc_6455__

#include <stdint.h>

#define RFC6455_OPCODE_CONTINUATION    0x0
#define RFC6455_OPCODE_TEXT_FRAME      0x1
#define RFC6455_OPCODE_BINARY_FRAME    0x2
#define RFC6455_OPCODE_NON_CONTROL_3   0x3
#define RFC6455_OPCODE_NON_CONTROL_4   0x4
#define RFC6455_OPCODE_NON_CONTROL_5   0x5
#define RFC6455_OPCODE_NON_CONTROL_6   0x6
#define RFC6455_OPCODE_NON_CONTROL_7   0x7
#define RFC6455_OPCODE_NON_CLOSE       0x8
#define RFC6455_OPCODE_PING            0x9
#define RFC6455_OPCODE_PONG            0xA
#define RFC6455_OPCODE_CONTROL_B       0xB
#define RFC6455_OPCODE_CONTROL_C       0xC
#define RFC6455_OPCODE_CONTROL_D       0xD
#define RFC6455_OPCODE_CONTROL_E       0xE
#define RFC6455_OPCODE_CONTROL_F       0xF

#pragma pack(push, 1)

typedef struct {
    uint8_t fin:1;                        // Word 0 bit 0
    uint8_t rsv:3;                        // Word 0 bits 1-3
    uint8_t opcode:4;                     // Word 0 bits 4-7
    uint8_t mask:1;                       // Word 0 bit 8
    uint8_t len:7;                        // Word 0 bits 9-15
    union {
       struct { uint16_t xlen_16; };     // Word 0 bit 16-31
       struct { uint64_t xlen_64; };     // Word 0 bit 16-31 + word 1 bits 0-31 + word 2 bits 0-15
       char xlen_bytes[4];               // Raw bytes of the extended payload length
    };
    uint32_t key[0];                     // If mask: word 2 bits 16-31 + word 3 bits 0-15
} ws_frame_header;

#pragma pack(pop)

#endif // defined(__rfc_6455__)
