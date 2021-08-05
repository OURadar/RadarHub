//
//  RKReporter.c
//  RadarHub
//
//  Created by Boonleng Cheong on 8/3/2021.
//  Copyright (c) 2021 Boonleng Cheong. All rights reserved.
//

#include <reporter.h>

typedef union {
    uint32_t u32;
    uint8_t code[4];
} RKMaskKey;

static char *RKGetHandshakeArgument(const char *buf, const char *key) {
    static char argument[80] = {0};
    char *b, *e;
    b = strstr(buf, key);
    if (b == NULL) {
        argument[0] = '\0';
        return argument;
    }
    b += strlen(key) + 2;
    e = strstr(b, "\r\n");
    size_t l = (size_t)(e - b);
    memcpy(argument, b, l);
    argument[l] = '\0';
    return argument;
}

static size_t RKEncodeWebsocketFrame(void *buf, RFC6455_OPCODE code, const bool mask, const void *src, size_t size) {
    size_t r;
    ws_frame_header *h = buf;
    memset(h, 0, sizeof(ws_frame_header));
    h->fin = 1;
    h->mask = mask;
    h->opcode = code;
    if (size == 0) {
        if (src == NULL) {
            r = 0;
        } else {
            r = strlen((char *)src);
        } 
    } else {
        r = size;
    }
    if (r > 65535) {
        h->len = 127;
    } else if (r > 125) {
        h->len = 126;
    } else {
        h->len = r;
    }
    if (src) {
        printf("Payload: \033[38;5;82m%s\033[m\n", (char *)src);
        char *payload = buf + sizeof(ws_frame_header) + 4 * h->mask;
        memcpy(payload, src, h->len);
        if (h->mask) {
            RKMaskKey key = {.u32 = rand()};
            *((uint32_t *)&h[1]) = key.u32;
            for (int i = 0; i < h->len; i++) {
                payload[i] ^= key.code[i % 4];
            }
        }
    }
    return sizeof(ws_frame_header) + 4 * h->mask + h->len;
}

static size_t RKDecodeWebsocketFrame(void **dst, void *buf) {
    size_t r;
    ws_frame_header *h = buf;
    char *payload = buf + sizeof(ws_frame_header) + 4 * h->mask;
    if (h->len == 127) {
        r = *(uint64_t *)payload;
        payload += 8;
    } else if (h->len == 126) {
        r = *(uint16_t *)payload;
        payload += 2;
    } else {
        r = h->len;
    }
    payload[h->len] = '\0';
    RKMaskKey key = {.u32 = *(uint32_t *)&h[1]};
    if (h->mask) {
        for (int i = 0; i < h->len; i++) {
            payload[i] ^= key.code[i % 4];
        }
    }
    *dst = payload;
    return r;
}

#pragma mark - Life Cycle

RKReporter *RKReporterInit(const char *radar, const char *host, const RKSSLFlag flag) {
    int r;
    char *c;
    size_t len;

    RKReporter *R = (RKReporter *)malloc(sizeof(RKReporter));
    memset(R, 0, sizeof(RKReporter));
    pthread_attr_init(&R->threadAttributes);
    pthread_mutex_init(&R->lock, NULL);

    printf("Using %s ...\n", host);

    strncpy(R->radar, radar, 16);
    c = strstr(host, ":");
    if (c == NULL) {
        R->port = 80;
        strcpy(R->host, host);
    } else {
        R->port = atoi(c + 1);
        len = (size_t)(c - host);
        strncpy(R->host, host, len);
        R->host[len] = '\0';
    }
    struct hostent *entry = gethostbyname(R->host);
    c = inet_ntoa(*((struct in_addr *)entry->h_addr_list[0]));
    if (c) {
        strcpy(R->ip, c);
    } else {
        fprintf(stderr, "Error getting IP address.\n");
        free(R);
        return NULL;
    }
    if (flag == RKSSLFlagAuto) {
        R->useSSL = R->port == 443;
    } else {
        R->useSSL = flag == RKSSLFlagOn;
    }

    if ((R->sd = socket(AF_INET, SOCK_STREAM, 0)) == 0) {
        fprintf(stderr, "Error opening socket\n");
        free(R);
        return NULL;
    }

    printf("Connecting %s:%d %s...\n", R->ip, R->port, R->useSSL ? "(\033[38;5;220mssl\033[m) " : "");

    R->sa.sin_family = AF_INET;
    R->sa.sin_port = htons(R->port);
    if (inet_pton(AF_INET, R->ip, &R->sa.sin_addr) <= 0) {
        fprintf(stderr, "Invalid address / address not supported \n");
        free(R);
        return NULL;
    }
    if ((r = connect(R->sd, (struct sockaddr *)&R->sa, sizeof(struct sockaddr_in))) < 0) {
        fprintf(stderr, "Connection failed.  r = %d\n", r);
        free(R);
        return NULL;
    }
    if (R->useSSL) {
        if (R->sslContext == NULL) {
            SSL_library_init();
            SSL_load_error_strings();
            R->sslContext = SSL_CTX_new(SSLv23_method());
            R->ssl = SSL_new(R->sslContext);
        }
        SSL_set_fd(R->ssl, R->sd);
        SSL_connect(R->ssl);
    }

    char buf[1024] = {0};
    strcpy(R->secret, "RadarHub39EzLkh9GBhXDw");
    sprintf(buf,
        "GET /ws/%s/ HTTP/1.1\r\n"
        "Host: %s\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Key: %s==\r\n"
        "Sec-WebSocket-Protocol: chat, superchat\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "\r\n",
        R->radar,
        R->host,
        R->secret);

    printf("%s", buf);

    RKReporterWrite(R, buf, strlen(buf));
    do {
        r = RKReporterRead(R, buf + r, sizeof(buf) - r);
    } while (r == 0 || strstr((char *)buf, "\r\n\r\n") == NULL);
    if (r < 0) {
        fprintf(stderr, "Error during handshake.\n");
    }
    if (c) {
        printf("%s\n", c);
        buf[r] = '\0';
    }
    printf("%s", buf);

    strcpy(R->digest, RKGetHandshakeArgument(buf, "Sec-WebSocket-Accept"));
    printf("R->digest = %s\n", R->digest);

    if (strcmp(R->digest, "Irr1KGdq6r9dz93/ZSPSnh9ZJ68=")) {
        fprintf(stderr, "Error. Unexpected digest.\n");
    }
    // Should have secret to verify the return digest, websocket upgrade, connection upgrade, etc.

    // Call onOpen here for client to handle additional tasks after the connection is established.

    return R;
}

void RKReporterFree(RKReporter *R) {
    pthread_attr_destroy(&R->threadAttributes);
    pthread_mutex_destroy(&R->lock);
    free(R);
}

#pragma mark - Properties

void RKReporterSetOpenHandler(RKReporter *R, int (*routine)(RKReporter *)) {
    R->onOpen = routine;
}

void RKReporterSetCloseHandler(RKReporter *R, int (*routine)(RKReporter *)) {
    R->onClose = routine;
}

void RKReporterSetMessageHandler(RKReporter *R, int (*routine)(RKReporter *)) {
    R->onMessage = routine;
}

void RKReporterSetErrorHandler(RKReporter *R, int (*routine)(RKReporter *)) {
    R->onError = routine;
}

#pragma mark - Methods

int RKReporterRead(RKReporter *R, void *buf, size_t size) {
    if (R->useSSL) {
        return SSL_read(R->ssl, buf, size);
    }
    return read(R->sd, buf, size);
}

int RKReporterWrite(RKReporter *R, void *buf, size_t size) {
    if (R->useSSL) {
        return SSL_write(R->ssl, buf, size);
    }
    return write(R->sd, buf, size);
}

static int RKReporterPingPong(RKReporter *R, const bool ping, const char *message, const int len) {
    size_t size = RKEncodeWebsocketFrame(R->buf,
        ping ? RFC6455_OPCODE_PING : RFC6455_OPCODE_PONG, true,
        message, message == NULL ? 0 : (len == 0 ? strlen(message) : len));
    int r = RKReporterWrite(R, R->buf, size);
    if (r < 0) {
        fprintf(stderr, "Error. Unable to write. r = %d\n", r);
    } else if (R->verbose > 1) {
        printf("Frame of size %zu / %d sent.\n", size, r);
    }
    return r;
}

static int RKReporterPing(RKReporter *R, const char *message, const int len) {
    return RKReporterPingPong(R, true, message, len);
}

static int RKReporterPong(RKReporter *R, const char *message, const int len) {
    return RKReporterPingPong(R, false, message, len);
}

static void RKReporterShowFrameHeader(RKReporter *R) {
    uint8_t *c = (uint8_t *)R->buf;
    ws_frame_header *h = (ws_frame_header *)c;
    if (h->mask) {
        printf("%02x %02x   %02x %02x %02x %02x    %02x %02x %02x %02x %02x %02x %02x %02x"
            "    fin=%d  opcode=%x  mask=%d  len=%d\n", 
            c[0], c[1],
            c[2], c[3], c[4], c[5],
            c[6], c[7], c[8], c[9], c[10], c[11], c[12], c[13],
            h->fin, h->opcode, h->mask, h->len);
    } else {
        printf("%02x %02x   %02x %02x %02x %02x %02x %02x %02x %02x"
            "    fin=%d  opcode=%x  mask=%d  len=%d\n", 
            c[0], c[1],
            c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9],
            h->fin, h->opcode, h->mask, h->len);
    }
}

void *theReporter(void *in) {
    RKReporter *R = (RKReporter *)in;

    char *payload;
    ws_frame_header *h = (ws_frame_header *)R->buf;

    int r = 0;
    int k = 0;
    size_t size;    
    const char words[][6] = {"love", "hope", "gift", "tale", "brag", "jail", "bull", "fade"};

    R->verbose = 1;
    while (R->wantActive) {
        // select()
        // check rfd, wfd, efd,
        // read, or write

        // r = select(R->sd, )

        // h->len = sprintf(payload, "{\"radar\":\"px1000\",\"command\":\"hello\"}");

        if (k++ % 100 == 0) {
            char *word = words[rand() % 8];
            r = RKReporterPing(R, word, strlen(word));
            if (R->verbose) {
                printf("%2d sent  ", r); RKReporterShowFrameHeader(R);
            }

            r = RKReporterRead(R, R->buf, sizeof(R->buf));
            if (r < 0) {
                fprintf(stderr, "Read error. r = %d\n", r);
                R->wantActive = false;
                break;
            }
            if (R->verbose) {
                memset(R->buf + r, 0, 4);
                printf("%2d read  ", r); RKReporterShowFrameHeader(R);
            }
            
            size = RKDecodeWebsocketFrame((void **)&payload, R->buf);
            printf("Payload: \033[38;5;220m%s\033[m\n", payload);

            if (h->opcode == RFC6455_OPCODE_PING) {
                RKReporterPong(R, payload, h->len);

                // Resume the previous expected reply
                r = RKReporterRead(R, R->buf, sizeof(R->buf));
                if (r < 0) {
                    fprintf(stderr, "Read error. r = %d\n", r);
                    R->wantActive = false;
                    break;
                }
                if (R->verbose) {
                    memset(R->buf + r, 0, 4);
                    printf("%2d read  ", r); RKReporterShowFrameHeader(R);
                }

                size = RKDecodeWebsocketFrame((void **)&payload, R->buf);
                printf("Payload: \033[38;5;220m%s\033[m\n", payload);
            } else if (h->opcode == RFC6455_OPCODE_CLOSE) {
                R->wantActive = false;
            }
        }        

        usleep(100000);
    }

    return NULL;
}

void RKReporterRun(RKReporter *R) {
    pthread_mutex_lock(&R->lock);
    R->wantActive = true;
    pthread_mutex_unlock(&R->lock);
    if (pthread_create(&R->threadId, &R->threadAttributes, theReporter, R)) {
        fprintf(stderr, "Unable to launch a run loop\n");
    }
    return;
}

void RKReporterStop(RKReporter *R) {
    pthread_mutex_lock(&R->lock);
    R->wantActive = false;
    pthread_mutex_unlock(&R->lock);
    pthread_join(R->threadId, NULL);
}
