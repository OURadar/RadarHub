//
//  RKWebSocket.h
//  RadarHub
//
//  WebSocket backend for calling home server
//
//  I named this RKWebSocket as I am just incubating this module
//  here for a quick start. Once sufficiently mature, it will be
//  incorporated into RadarKit. This may still be left here as a
//  simple demo module for RadarHub communication.
//
//  Created by Boonleng Cheong on 8/3/2021.
//  Copyright (c) 2021 Boonleng Cheong. All rights reserved.
//

#ifndef __RadarKit_WebSocket__
#define __RadarKit_WebSocket__

#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <pthread.h>

#include <openssl/ssl.h>
#include <openssl/err.h>
#include <openssl/crypto.h>

#include "ws.h"
#include "common.h"

#define RKWebSocketFrameSize                     (1024 * 1024)
#define RKWebSocketPayloadDepth                  1000
#define RKWebSocketTimeoutDeltaMicroseconds      10000
#define RKWebSocketTimeoutThresholdSeconds       20.0

#ifndef htonll
#define htonll(x) (((uint64_t)htonl((x) & 0xFFFFFFFF) << 32) | htonl((x) >> 32))
#define ntohll(x) (((uint64_t)ntohl((x) & 0xFFFFFFFF) << 32) | ntohl((x) >> 32))
#endif

typedef uint8_t RKWebSocketSSLFlag;
enum {
    RKWebSocketFlagSSLAuto,
    RKWebSocketFlagSSLOff,
    RKWebSocketFlagSSLOn
};

typedef struct rk_websocket_payload {
    void    *source;
    size_t  size;
} RKWebSocketPayload;

typedef struct rk_websocket RKWebSocket;

struct rk_websocket {
    char                     host[80];
    char                     path[80];
    int                      port;
    bool                     useSSL;
    int                      verbose;

    void                     (*onOpen)(RKWebSocket *);
    void                     (*onClose)(RKWebSocket *);
    void                     (*onError)(RKWebSocket *);
    void                     (*onMessage)(RKWebSocket *, void*, size_t);

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

    RKWebSocketPayload       payloads[RKWebSocketPayloadDepth];                // References of payloads
    uint16_t                 payloadHead;                                      // The one ahead
    uint16_t                 payloadTail;                                      // The one following

    useconds_t               timeoutDeltaMicroseconds;                         // Timeout of select()
    uint32_t                 timeoutThreshold;                                 // Internal variable
    uint32_t                 timeoutCount;                                     // Internal variable
    uint64_t                 tic;

    uint8_t                  frame[RKWebSocketFrameSize];                      // A local buffer to store a frame
};


RKWebSocket *RKWebSocketInit(const char *, const char *, const RKWebSocketSSLFlag);
void RKWebSocketFree(RKWebSocket *);

void RKWebSocketSetPath(RKWebSocket *, const char *);
void RKWebSocketSetPingInterval(RKWebSocket *, const float);
void RKWebSocketSetOpenHandler(RKWebSocket *, void (*)(RKWebSocket *));
void RKWebSocketSetCloseHandler(RKWebSocket *, void (*)(RKWebSocket *));
void RKWebSocketSetMessageHandler(RKWebSocket *, void (*)(RKWebSocket *, void *, size_t));
void RKWebSocketSetErrorHandler(RKWebSocket *, void (*)(RKWebSocket *));

// This is technically RKWebSocketStartAsClient()
// No plans to make RKWebSocketStartAsServer()
void RKWebSocketStart(RKWebSocket *);

// Stop the server
void RKWebSocketStop(RKWebSocket *);

// Wait until all payloads are sent
// NOTE: Do no use this within handler functions (OpenHandler, MessageHandler, etc.)
void RKWebSocketWait(RKWebSocket *);

// Send a packet
int RKWebSocketSend(RKWebSocket *, void *, size_t);

#endif
