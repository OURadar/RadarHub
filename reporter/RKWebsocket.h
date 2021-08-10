//
//  RKWebsocket.h
//  RadarHub
//
//  Websocket backend for calling home server
//
//  I named this RKWebsocket as I am just incubating this module
//  here for a quick start. Once sufficiently mature, it will be
//  incorporated into RadarKit. This may still be left here as a
//  simple demo module for RadarHub communication.
//
//  Created by Boonleng Cheong on 8/3/2021.
//  Copyright (c) 2021 Boonleng Cheong. All rights reserved.
//

#ifndef __RadarKit_Websocket__
#define __RadarKit_Websocket__

#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <sys/socket.h>
#include <netdb.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>

#include <openssl/ssl.h>
#include <openssl/err.h>
#include <openssl/crypto.h>

#include "ws.h"
#include "common.h"

#define RKWebsocketFrameSize                     (1024 * 1024)
#define RKWebsocketPayloadDepth                  1000
#define RKWebsocketTimeoutDeltaMicroseconds      10000
#define RKWebsocketTimeoutThresholdSeconds       20.0

#ifndef htonll
#define htonll(x) (((uint64_t)htonl((x) & 0xFFFFFFFF) << 32) | htonl((x) >> 32))
#define ntohll(x) (((uint64_t)ntohl((x) & 0xFFFFFFFF) << 32) | ntohl((x) >> 32))
#endif

typedef uint8_t RKWebsocketSSLFlag;
enum RKWebsocketSSLFlag {
    RKWebsocketSSLAuto,
    RKWebsocketSSLOff,
    RKWebsocketSSLOn
};

typedef struct rk_reporter_payload {
    void    *source;
    size_t  size;
} RKWebsocketPayload;

typedef struct rk_reporter RKWebsocket;

struct rk_reporter {
    char                     host[80];
    char                     path[80];
    int                      port;
    bool                     useSSL;
    int                      verbose;

    void                     (*onOpen)(RKWebsocket *);
    void                     (*onClose)(RKWebsocket *);
    void                     (*onError)(RKWebsocket *);
    void                     (*onMessage)(RKWebsocket *, void*, size_t);

    char                     ip[INET6_ADDRSTRLEN];                             // IP in string
    struct sockaddr_in       sa;                                               // Socket address
    int                      sd;                                               // Socket descriptor
    SSL_CTX                  *sslContext;                                      // SSL context
    SSL                      *ssl;                                             // SSL
    char                     secret[26];                                       //
    char                     digest[64];                                       // Handshake Sec-WebSocket-Accept
    char                     upgrade[64];                                      // Handshake Upgrade
    char                     connection[64];                                   // Handshake Connection
    bool                     wantActive;
    bool                     connected;

    pthread_t                threadId;                                         // Own thread ID
    pthread_attr_t           threadAttributes;                                 // Thread attributes
    pthread_mutex_t          lock;                                             // Thread safety mutex of the server

    RKWebsocketPayload       payloads[RKWebsocketPayloadDepth];                // References of payloads
    uint16_t                 payloadHead;                                      // The one ahead
    uint16_t                 payloadTail;                                      // The one following

    useconds_t               timeoutDeltaMicroseconds;                         // Timeout of select()
    uint32_t                 timeoutThreshold;                                 // Internal variable
    uint32_t                 timeoutCount;                                     // Internal variable

    uint8_t                  frame[RKWebsocketFrameSize];                      // A local buffer to store a frame
};


RKWebsocket *RKWebsocketInit(const char *, const char *, const RKWebsocketSSLFlag);
void RKWebsocketFree(RKWebsocket *);

void RKWebsocketSetPath(RKWebsocket *, const char *);
void RKWebsocketSetPingInterval(RKWebsocket *, const float);
void RKWebsocketSetOpenHandler(RKWebsocket *, void (*)(RKWebsocket *));
void RKWebsocketSetCloseHandler(RKWebsocket *, void (*)(RKWebsocket *));
void RKWebsocketSetMessageHandler(RKWebsocket *, void (*)(RKWebsocket *, void *, size_t));
void RKWebsocketSetErrorHandler(RKWebsocket *, void (*)(RKWebsocket *));

// This is technically RKWebsocketStartAsClient()
// No plans to make RKWebsocketStartAsServer()
void RKWebsocketStart(RKWebsocket *);

// Stop the server
void RKWebsocketStop(RKWebsocket *);

// Wait until all payloads are sent
// NOTE: Do no use this within handler functions (OpenHandler, MessageHandler, etc.)
void RKWebsocketWait(RKWebsocket *);

// Send a packet
int RKWebsocketSend(RKWebsocket *, void *, size_t);

#endif
