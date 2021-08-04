//
//  RKReporter.c
//  RadarHub
//
//  Created by Boonleng Cheong on 8/3/2021.
//  Copyright (c) 2021 Boonleng Cheong. All rights reserved.
//

#include <reporter.h>

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
        // "GET / HTTP/1.1\r\n"
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

void *theReporter(void *in) {
    RKReporter *R = (RKReporter *)in;

    void *buf = malloc(1024);
    char *payload;
    size_t r = 0;
    uint8_t *c = buf;
    ws_frame_header *h = buf;    

    sleep(1);

    int k = 0;
    while (R->wantActive) {
        // select()
        // check rfd, wfd, efd,
        // read, or write

        // r = select(R->sd, )

        if (k++ % 100 == 0) {

            // Make a ping frame
            memset(h, 0, sizeof(ws_frame_header));
            h->fin = 1;
            h->mask = 1;
            h->opcode = RFC6455_OPCODE_PING;
            // h->opcode = RFC6455_OPCODE_TEXT;
            payload = buf + sizeof(ws_frame_header) + 4 * h->mask;
            h->len = sprintf(payload, "Hello");
            // h->len = sprintf(payload, "{\"radar\":\"px1000\",\"command\":\"hello\"}");
            if (h->mask) {
                c[2] = 0x37;
                c[3] = 0xfa;
                c[4] = 0x21;
                c[5] = 0x3d;
            }
            printf("Payload: \033[38;5;82m%s\033[m\n", payload);
            for (int i = 0; i < h->len; i++) {
                int j = i % 4;
                payload[i] ^= c[2 + j];
            }
            
            printf("%02x %02x   %02x %02x %02x %02x    %02x %02x %02x %02x %02x"
                "    fin=%d  opcode=%x  mask=%d  len=%d\n", 
                c[0], c[1],
                c[2], c[3], c[4], c[5],
                c[6], c[7], c[8], c[9], c[10],
                h->fin, h->opcode, h->mask, h->len);
            size_t size = sizeof(ws_frame_header) + 4 * h->mask + h->len;
            r = RKReporterWrite(R, buf, size);
            if (r < 0) {
                fprintf(stderr, "Error. Unable to write.\n");
                return NULL;
            }
            printf("Frame of size %zu / %zu sent.\n", size, r);
            
            r = RKReporterRead(R, buf, 1024);
            if (r < 0) {
                fprintf(stderr, "Read error. r = %zu\n", r);
                break;
            }
            printf("Frame of size %zu received.\n", r);
            printf("%02x %02x   %02x %02x %02x %02x    %02x %02x %02x %02x %02x"
                "    fin=%d  opcode=%x  mask=%d  len=%d\n", 
                c[0], c[1],
                c[2], c[3], c[4], c[5],
                c[6], c[7], c[8], c[9], c[10],
                h->fin, h->opcode, h->mask, h->len);
            payload = buf + sizeof(ws_frame_header) + 4 * h->mask;
            payload[h->len] = '\0';
            if (h->mask) {
                for (int i = 0; i < h->len; i++) {
                    int j = i % 4;
                    payload[i] ^= c[2 + j];
                }
            }
            printf("Payload: \033[38;5;82m%s\033[m\n", payload);

            if (h->opcode == RFC6455_OPCODE_CLOSE) {
                R->wantActive = false;
            }
        }        

        usleep(100000);
    }

    free(buf);

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
