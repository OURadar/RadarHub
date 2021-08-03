#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <sys/socket.h>
#include <netdb.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>

typedef struct rk_reporter {
    char                            radar[16];
    char                            host[80];
    char                            ip[64];
    bool                            ssl;
    int                             port;
    struct sockaddr_in              address;
    int                             sd;
} RKReporter;

RKReporter *RKReporterInit(const char *radar, const char *host) {
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

    if ((reporter->sd = socket(AF_INET, SOCK_STREAM, 0)) == 0) {
        fprintf(stderr, "Error opening socket\n");
        free(reporter);
        return NULL;
    }

    printf("Connecting %s:%d ...\n", reporter->ip, reporter->port);

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

    char buf[2048] = {0};
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

    // printf("%s\n", buf);

    send(reporter->sd, buf, strlen(buf), 0);

    r = read(reporter->sd, buf, sizeof(buf));
    buf[r] = '\0';

    printf("%s\n", buf);

    return reporter;
}

void RKReporterFree(RKReporter *reporter) {
    free(reporter);
}

int main(int argc, const char *argv[]) {

    RKReporter *hope = NULL;

    if (argc == 1) {
        hope = RKReporterInit("px1000", "localhost:8000");
    } else {
        hope = RKReporterInit("px1000", argv[1]);
    }

    RKReporterFree(hope);

    exit(EXIT_SUCCESS);
}
