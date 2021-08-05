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

#pragma mark - Static Methods

static char *RKGetHandshakeArgument(const char *buf, const char *key) {
    static char argument[80] = {0};
    char *b, *e;
    b = strstr(buf, key);
    if (b == NULL) {
        argument[0] = '\0';
        return argument;
    }
    b += strlen(key);
    while (*b == ':' || *b == ' ') {
        b++;
    }
    e = strstr(b, "\r\n");
    size_t l = (size_t)(e - b);
    memcpy(argument, b, l);
    argument[l] = '\0';
    return argument;
}

static int RKSocketRead(RKReporter *R, void *buf, size_t size) {
    if (R->useSSL) {
        return SSL_read(R->ssl, buf, size);
    }
    return read(R->sd, buf, size);
}

static int RKSocketWrite(RKReporter *R, void *buf, size_t size) {
    if (R->useSSL) {
        return SSL_write(R->ssl, buf, size);
    }
    return write(R->sd, buf, size);
}

static size_t RKWebsocketFrameEncode(void *buf, RFC6455_OPCODE code, const void *src, size_t size) {
    size_t r;
    ws_frame_header *h = buf;
    memset(h, 0, sizeof(ws_frame_header));
    h->fin = 1;
    h->mask = true;
    h->opcode = code;
    char *payload = buf + sizeof(ws_frame_header) + 4 * h->mask;
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
        *((uint64_t *)payload) = (uint64_t)r;
        if (payload[0] & 80) {
            fprintf(stderr, "The MSB of uint64_t size must be 0.\n");
        }
        payload += 8;
        r += sizeof(ws_frame_header) + 4 * h->mask + 8;
    } else if (r > 125) {
        h->len = 126;
        *((uint16_t *)payload) = (uint16_t)r;
        payload += 2;
        r += sizeof(ws_frame_header) + 4 * h->mask + 2;
    } else {
        h->len = r;
        r += sizeof(ws_frame_header) + 4 * h->mask;
    }
    if (src) {
        memcpy(payload, src, h->len);
        payload[h->len] = '\0';
        if (h->mask) {
            RKMaskKey key = {.u32 = rand()};
            *((uint32_t *)&h[1]) = key.u32;
            for (int i = 0; i < h->len; i++) {
                payload[i] ^= key.code[i % 4];
            }
        }
    }
    return r;
}

static size_t RKWebsocketFrameDecode(void **dst, void *buf) {
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
    if (h->mask) {
        RKMaskKey key = {.u32 = *(uint32_t *)&h[1]};
        for (int i = 0; i < h->len; i++) {
            payload[i] ^= key.code[i % 4];
        }
    }
    *dst = payload;
    return r;
}

static int RKWebsocketPingPong(RKReporter *R, const bool ping, const char *message, const int len) {
    size_t size = RKWebsocketFrameEncode(R->buf,
        ping ? RFC6455_OPCODE_PING : RFC6455_OPCODE_PONG,
        message, message == NULL ? 0 : (len == 0 ? strlen(message) : len));
    int r = RKSocketWrite(R, R->buf, size);
    if (r < 0) {
        fprintf(stderr, "Error. Unable to write. r = %d\n", r);
    } else if (R->verbose > 1) {
        printf("Frame of size %zu / %d sent.\n", size, r);
    }
    return r;
}

static int RKWebsocketPing(RKReporter *R, const char *message, const int len) {
    return RKWebsocketPingPong(R, true, message, len);
}

static int RKWebsocketPong(RKReporter *R, const char *message, const int len) {
    return RKWebsocketPingPong(R, false, message, len);
}

static void RKShowWebsocketFrameHeader(RKReporter *R) {
    uint8_t *c = (uint8_t *)R->buf;
    ws_frame_header *h = (ws_frame_header *)c;
    if (h->mask) {
        printf("%02x %02x   %02x %02x %02x %02x    %02x %02x %02x %02x %02x %02x %02x %02x ..."
            "    fin=%d  opcode=%x  mask=%d  len=%d\n",
            c[0], c[1],
            c[2], c[3], c[4], c[5],
            c[6], c[7], c[8], c[9], c[10], c[11], c[12], c[13],
            h->fin, h->opcode, h->mask, h->len);
    } else {
        printf("%02x %02x                  %02x %02x %02x %02x %02x %02x %02x %02x ..."
            "    fin=%d  opcode=%x  mask=%d  len=%d\n",
            c[0], c[1],
            c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9],
            h->fin, h->opcode, h->mask, h->len);
    }
}

static int RKWebsocketConnect(RKReporter *R) {
    int r;
    char *c;
    struct hostent *entry = gethostbyname(R->host);
    c = inet_ntoa(*((struct in_addr *)entry->h_addr_list[0]));
    if (c) {
        strcpy(R->ip, c);
    } else {
        fprintf(stderr, "Error getting IP address.\n");
        return -1;
    }

    if ((R->sd = socket(AF_INET, SOCK_STREAM, 0)) == 0) {
        fprintf(stderr, "Error opening socket\n");
        return -1;
    }

    printf("Connecting %s:%d %s...\n", R->ip, R->port,
       R->useSSL ? "(\033[38;5;220mssl\033[m) " : "");

    R->sa.sin_family = AF_INET;
    R->sa.sin_port = htons(R->port);
    if (inet_pton(AF_INET, R->ip, &R->sa.sin_addr) <= 0) {
        fprintf(stderr, "Invalid address / address not supported \n");
        return -1;
    }
    if ((r = connect(R->sd, (struct sockaddr *)&R->sa, sizeof(struct sockaddr_in))) < 0) {
        fprintf(stderr, "Connection failed.  r = %d\n", r);
        return -1;
    }
    if (R->useSSL) {
        SSL_set_fd(R->ssl, R->sd);
        SSL_connect(R->ssl);
    }

    char *buf = (char *)R->buf;
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
    if (R->verbose) {
        printf("%s", buf);
    }

    RKSocketWrite(R, buf, strlen(buf));
    do {
        r = RKSocketRead(R, buf + r, RKReporterBufferSize - r);
    } while (r == 0 || strstr((char *)buf, "\r\n\r\n") == NULL);
    if (r < 0) {
        fprintf(stderr, "Error during handshake.\n");
    }
    if (c) {
        printf("%s\n", c);
        buf[r] = '\0';
    }
    if (R->verbose) {
        printf("%s", buf);
    }

    // Verify the return digest, websocket upgrade, connection upgrade, etc.
    strcpy(R->digest, RKGetHandshakeArgument(buf, "Sec-WebSocket-Accept"));
    strcpy(R->upgrade, RKGetHandshakeArgument(buf, "Upgrade"));
    strcpy(R->connection, RKGetHandshakeArgument(buf, "Connection"));

    if (strcmp(R->digest, "Irr1KGdq6r9dz93/ZSPSnh9ZJ68=")) {
        fprintf(stderr, "Error. R->digest = %s\n", R->digest);
        fprintf(stderr, "Error. Unexpected digest.\n");
    }

    if (strcasecmp(R->upgrade, "WebSocket")) {
        fprintf(stderr, "Error. R->upgrade = %s\n", R->upgrade);
        fprintf(stderr, "Error. Connection is not websocket.\n");
    }

    if (strcasecmp(R->connection, "upgrade")) {
        fprintf(stderr, "Error. R->connection = %s\n", R->connection);
        fprintf(stderr, "Error. Connection did not get upgraded.\n");
    }

    // Call onOpen here for client to handle additional tasks after the connection is established.
    if (R->onOpen) {
        R->onOpen(R);
    }

    R->connected = true;

    return 0;
}

#pragma mark - Life Cycle

RKReporter *RKReporterInit(const char *radar, const char *host, const RKSSLFlag flag) {
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
    if (flag == RKSSLFlagAuto) {
        R->useSSL = R->port == 443;
    } else {
        R->useSSL = flag == RKSSLFlagOn;
    }
    if (R->useSSL) {
        SSL_library_init();
        SSL_load_error_strings();
        R->sslContext = SSL_CTX_new(SSLv23_method());
        R->ssl = SSL_new(R->sslContext);
    }
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

void RKReporterSetMessageHandler(RKReporter *R, int (*routine)(RKReporter *, void *, size_t)) {
    R->onMessage = routine;
}

void RKReporterSetErrorHandler(RKReporter *R, int (*routine)(RKReporter *)) {
    R->onError = routine;
}

#pragma mark - Methods

void *theReporter(void *in) {
    RKReporter *R = (RKReporter *)in;
    R->verbose = 1;

    void *payload;
    ws_frame_header *h = (ws_frame_header *)R->buf;

    int r = 0;
    int k = 0;
    size_t size;    
    char words[][5] = {"love", "hope", "cool", "cute", "idea", "nice", "work", "wish"};
    char uword[5] = "xxxx";

    while (R->wantActive) {

        RKWebsocketConnect(R);
        
        while (R->wantActive && R->connected) {
            // select()
            // check rfd, wfd, efd,
            // read, or write

            // r = select(R->sd, )

            // h->len = sprintf(payload, "{\"radar\":\"px1000\",\"command\":\"hello\"}");

            if (k++ % 100 == 0) {
                pthread_mutex_lock(&R->lock);
                char *word = words[rand() % 8];
                r = RKWebsocketPing(R, word, strlen(word));
                if (R->verbose) {
                    RKMaskKey key = {.u32 = *((uint32_t *)&R->buf[2])};
                    for (int i = 0; i < 4; i++) {
                        uword[i] = R->buf[6 + i] ^ key.code[i % 4];
                    }
                    printf("Payload: \033[38;5;82m%s\033[m\n", uword);
                    printf("%2d sent  ", r); RKShowWebsocketFrameHeader(R);
                }

                r = RKSocketRead(R, R->buf, RKReporterBufferSize);
                if (r < 0) {
                    fprintf(stderr, "Read error. r = %d\n", r);
                    pthread_mutex_unlock(&R->lock);
                    break;
                }
                size = RKWebsocketFrameDecode((void **)&payload, R->buf);

                if (R->verbose) {
                    printf("%2d read  ", r); RKShowWebsocketFrameHeader(R);
                    printf("Payload: \033[38;5;220m%s\033[m\n", (char *)payload);
                }

                if (h->opcode == RFC6455_OPCODE_PING) {
                    RKWebsocketPong(R, (char *)payload, h->len);
                    if (R->verbose) {
                        RKMaskKey key = {.u32 = *((uint32_t *)&R->buf[2])};
                        for (int i = 0; i < 4; i++) {
                            uword[i] = R->buf[6 + i] ^ key.code[i % 4];
                        }
                        printf("Payload: \033[38;5;82m%s\033[m\n", uword);
                        printf("%2d sent  ", r); RKShowWebsocketFrameHeader(R);
                    }

                    // Resume the previous expected reply
                    r = RKSocketRead(R, R->buf, RKReporterBufferSize);
                    if (r < 0) {
                        fprintf(stderr, "Read error. r = %d\n", r);
                        pthread_mutex_unlock(&R->lock);
                        break;
                    }
                    size = RKWebsocketFrameDecode((void **)&payload, R->buf);

                    if (R->verbose) {
                        printf("%2d read  ", r); RKShowWebsocketFrameHeader(R);
                        printf("Payload: \033[38;5;220m%s\033[m\n", payload);
                    }
                }

                if (h->opcode == RFC6455_OPCODE_CLOSE) {
                    R->connected = false;
                    if (R->onClose) {
                        R->onClose(R);
                    }
                } else {
                    if (R->onMessage) {
                        R->onMessage(R, payload, size);
                    }
                }
                pthread_mutex_unlock(&R->lock);
            } // if (k++ % 100 == 0) ...

            usleep(100000);
        }
        k = 0;
        do {
            if (k % 10 == 0) {
                printf("No connection. Reconnect in %d seconds ...\n", 5 - k / 10);
            }
            usleep(100000);
        } while (R->wantActive && k++ < 50);
    }

    return NULL;
}

void RKReporterStart(RKReporter *R) {
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
