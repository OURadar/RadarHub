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

#include <stdlib.h>
#include <stdint.h>

#pragma pack(push, 1)

typedef struct {
    uint8_t fin:1;                        // Word 0 bit 0
    uint8_t rsv:3;                        // Word 0 bits 1-3
    uint8_t opcode:4;                     // Word 0 bits 4-7
    uint8_t mask:1;                       // Word 0 bit 8
    uint8_t len:7;                        // Word 0 bits 9-15
    union {
       struct { uint16_t xlen_16; };     // Word 0 bit 16-31
       struct { uint64_t xlen_64; };     // Word 0 bit 16-31, Word 1 bits 0-31, Word 2 bits 0-15
       char xlen_bytes[4];               // Raw bytes of the extended payload length
    };
    uint32_t key;                        // Word 2, bits 16-31, Word 3, bits 0-15
    uint8_t payload[0];
} ws_frame_header;

#pragma pack(pop)

#endif // defined(__rfc_6455__)
