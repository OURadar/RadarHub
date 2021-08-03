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

typedef uint8_t RKSSLFlag;
enum RKSSLFlag {
    RKSSLFlagAuto,
    RKSSLFlagOff,
    RKSSLFlagOn
};

typedef struct rk_reporter {
    char                            radar[16];
    char                            host[80];
    char                            ip[64];
    int                             port;
    bool                            useSSL;
    struct sockaddr_in              address;
    int                             sd;
    SSL_CTX                         *sslContext;
    SSL                             *ssl;
} RKReporter;

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
    sprintf(buf,
        "GET /ws/%s/ HTTP/1.1\r\n"
        "Host: %s\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==\r\n"
        "Sec-WebSocket-Protocol: chat, superchat\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "\r\n",
        reporter->radar,
        reporter->host);

    printf("%s", buf);

    if (reporter->useSSL) {
        SSL_write(reporter->ssl, buf, strlen(buf));
        r = SSL_read(reporter->ssl, buf, sizeof(buf));
    } else {
        send(reporter->sd, buf, strlen(buf), 0);
        r = recv(reporter->sd, buf, sizeof(buf), 0);
    }

    buf[r] = '\0';

    printf("%s", buf);

    return reporter;
}

void RKReporterFree(RKReporter *reporter) {
    free(reporter);
}

int main(int argc, const char *argv[]) {

    RKReporter *hope = NULL;

    if (argc == 1) {
        hope = RKReporterInit("px1000", "localhost:8000", false);
    } else {
        hope = RKReporterInit("px1000", argv[1], false);
    }

    RKReporterFree(hope);

    exit(EXIT_SUCCESS);
}
