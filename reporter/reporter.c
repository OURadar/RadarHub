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

    RKReporter *reporter = (RKReporter *)malloc(sizeof(RKReporter));
    memset(reporter, 0, sizeof(RKReporter));

    printf("Using %s ...\n", host);

    strncpy(reporter->radar, radar, 16);
    c = strstr(host, ":");
    if (c == NULL) {
        reporter->port = 80;
        strcpy(reporter->host, host);
    } else {
        reporter->port = atoi(c + 1);
        len = (size_t)(c - host);
        strncpy(reporter->host, host, len);
        reporter->host[len] = '\0';
    }
    struct hostent *entry = gethostbyname(reporter->host);
    c = inet_ntoa(*((struct in_addr *)entry->h_addr_list[0]));
    if (c) {
        strcpy(reporter->ip, c);
    } else {
        fprintf(stderr, "Error getting IP address.\n");
        free(reporter);
        return NULL;
    }
    if (flag == RKSSLFlagAuto) {
        reporter->useSSL = reporter->port == 443;
    } else {
        reporter->useSSL = flag == RKSSLFlagOn;
    }

    if ((reporter->sd = socket(AF_INET, SOCK_STREAM, 0)) == 0) {
        fprintf(stderr, "Error opening socket\n");
        free(reporter);
        return NULL;
    }

    printf("Connecting %s:%d %s...\n", reporter->ip, reporter->port, reporter->useSSL ? "(ssl) " : "");

    reporter->address.sin_family = AF_INET;
    reporter->address.sin_port = htons(reporter->port);
    if (inet_pton(AF_INET, reporter->ip, &reporter->address.sin_addr) <= 0) {
        fprintf(stderr, "Invalid address / address not supported \n");
        free(reporter);
        return NULL;
    }
    if ((r = connect(reporter->sd, (struct sockaddr *)&reporter->address, sizeof(struct sockaddr_in))) < 0) {
        fprintf(stderr, "Connection failed.  r = %d\n", r);
        free(reporter);
        return NULL;
    }
    if (reporter->useSSL) {
        if (reporter->sslContext == NULL) {
            SSL_library_init();
            SSL_load_error_strings();
            reporter->sslContext = SSL_CTX_new(SSLv23_method());
            reporter->ssl = SSL_new(reporter->sslContext);
        }
        SSL_set_fd(reporter->ssl, reporter->sd);
        SSL_connect(reporter->ssl);
    }

    char buf[1024] = {0};
    strcpy(reporter->code, "RadarHub39EzLkh9GBhXDw");
    sprintf(buf,
        "GET /ws/%s/ HTTP/1.1\r\n"
        "Host: %s\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Key: %s==\r\n"
        "Sec-WebSocket-Protocol: chat, superchat\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "\r\n",
        reporter->radar,
        reporter->host,
        reporter->code);

    printf("%s", buf);

    RKReporterWrite(reporter, buf, strlen(buf));
    r = RKReporterRead(reporter, buf, sizeof(buf));
    if (r < 0) {
        fprintf(stderr, "Error during handshake.\n");
    }
    printf("%s", buf);

    strcpy(reporter->digest, RKGetHandshakeArgument(buf, "Sec-WebSocket-Accept"));
    printf("reporter->digest = %s\n", reporter->digest);

    // Should have codes to verify the return digest, websocket upgrade, connection upgrade, etc.

    // Call onOpen here for client to handle additional tasks after the connection is established.

    return reporter;
}

void RKReporterFree(RKReporter *reporter) {
    free(reporter);
}

#pragma mark - Methods

int RKReporterRead(RKReporter *reporter, void *buf, size_t size) {
    int k, r = 0;
    do {
        if (reporter->useSSL) {
            k = SSL_read(reporter->ssl, buf + r, size - r);
            if (k) {
                r += k;
            } else {
                return -1;
            }
        } else {
            k = recv(reporter->sd, buf + r, size - r, 0);
            if (k) {
                r += k;
            } else {
                return -1;
            }
        }
    } while (strstr((char *)buf, "\r\n\r\n") == NULL);
    ((char *)buf)[r] = '\0';
    return r;
}

int RKReporterWrite(RKReporter *reporter, void *buf, size_t size) {
    if (reporter->useSSL) {
        return SSL_write(reporter->ssl, buf, size);
    }
    return send(reporter->sd, buf, size, 0);
}

