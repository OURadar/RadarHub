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

    printf("Connecting %s:%d %s...\n", R->ip, R->port, R->useSSL ? "(ssl) " : "");

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
    r = RKReporterRead(R, buf, sizeof(buf));
    if (r < 0) {
        fprintf(stderr, "Error during handshake.\n");
    }
    printf("%s", buf);

    strcpy(R->digest, RKGetHandshakeArgument(buf, "Sec-WebSocket-Accept"));
    printf("R->digest = %s\n", R->digest);

    // Should have secret to verify the return digest, websocket upgrade, connection upgrade, etc.

    // Call onOpen here for client to handle additional tasks after the connection is established.

    return R;
}

void RKReporterFree(RKReporter *R) {
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
    int k, r = 0;
    do {
        if (R->useSSL) {
            if ((k = SSL_read(R->ssl, buf + r, size - r)) > 0) {
                r += k;
            } else {
                return -1;
            }
        } else {
            if ((k = recv(R->sd, buf + r, size - r, 0)) > 0) {
                r += k;
            } else {
                return -1;
            }
        }
    } while (strstr((char *)buf, "\r\n\r\n") == NULL);
    ((char *)buf)[r] = '\0';
    return r;
}

int RKReporterWrite(RKReporter *R, void *buf, size_t size) {
    if (R->useSSL) {
        return SSL_write(R->ssl, buf, size);
    }
    return send(R->sd, buf, size, 0);
}

void *theReporter(void *in) {
    RKReporter *R = (RKReporter *)in;
    int k = 0;
    while (R->wantActive) {
        printf("k = %d\n", k);
        usleep(1000000);
    }
    return NULL;
}

void RKReporterRun(RKReporter *R) {
    pthread_mutex_init(&R->lock, NULL);
    pthread_attr_init(&R->threadAttributes);
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
    pthread_attr_destroy(&R->threadAttributes);
    pthread_mutex_destroy(&R->lock);
}
