//
//  RKReporter.h
//  RadarHub
//
//  Created by Boonleng Cheong on 8/3/2021.
//  Copyright (c) 2021 Boonleng Cheong. All rights reserved.
//

#ifndef __RadarKit_Reporter__
#define __RadarKit_Reporter__

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

#define RKReporterBufferSize                    (1024 * 1024)
#define RKReporterPayloadDepth                  1000
#define RKReporterTimeoutDeltaMicroseconds      100000
#define RKReporterTimeoutThresholdSeconds       20

typedef uint8_t RKSSLFlag;
enum RKSSLFlag {
    RKSSLFlagAuto,
    RKSSLFlagOff,
    RKSSLFlagOn
};

typedef struct rk_reporter_payload {
    void    *source;
    size_t  size;
} RKReporterPayload;

typedef struct rk_reporter RKReporter;

struct rk_reporter {
    char                     radar[16];
    char                     host[80];
    int                      port;
    bool                     useSSL;
    int                      verbose;
    float                    pingInterval;                                     // Ping interval

    int                      (*onOpen)(RKReporter *);
    int                      (*onClose)(RKReporter *);
    int                      (*onError)(RKReporter *);
    int                      (*onMessage)(RKReporter *, void*, size_t);

    uint8_t                  buf[RKReporterBufferSize];                        // A local buffer to store a frame
    char                     ip[INET6_ADDRSTRLEN];                             // IP in string
    struct sockaddr_in       sa;                                               // Socket address
    int                      sd;                                               // Socket descriptor
    SSL_CTX                  *sslContext;
    SSL                      *ssl;
    char                     secret[26];
    char                     digest[30];                                       // Handshake Sec-WebSocket-Accept
    char                     upgrade[30];                                      // Handshake Upgrade
    char                     connection[30];                                   // Handshake Connection
    bool                     wantActive;
    bool                     connected;

    pthread_t                threadId;                                         // Own thread ID
    pthread_attr_t           threadAttributes;                                 // Thread attributes
    pthread_mutex_t          lock;                                             // Thread safety mutex of the server

    RKReporterPayload        payloads[RKReporterPayloadDepth];                 // References of payloads
    uint16_t                 payloadHead;                                      // The one ahead
    uint16_t                 payloadTail;                                      // The one following

    useconds_t               timeoutDeltaMicroseconds;                         //

    uint32_t                 timeoutCount;
    uint32_t                 timeoutThreshold;
};


RKReporter *RKReporterInit(const char *radar, const char *host, const RKSSLFlag);
void RKReporterFree(RKReporter *);

void RKReporterSetPingInterval(RKReporter *, const float);

void RKReporterSetOpenHandler(RKReporter *, int (*)(RKReporter *));
void RKReporterSetCloseHandler(RKReporter *, int (*)(RKReporter *));
void RKReporterSetMessageHandler(RKReporter *, int (*)(RKReporter *, void *, size_t));
void RKReporterSetErrorHandler(RKReporter *, int (*)(RKReporter *));

void RKReporterStart(RKReporter *);
void RKReporterStop(RKReporter *);

int RKReporterSend(RKReporter *, void *, size_t);

#endif
