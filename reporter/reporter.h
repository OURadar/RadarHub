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

typedef struct rk_reporter RKReporter;

struct rk_reporter {
    char                            radar[16];
    char                            host[80];
    char                            ip[64];
    int                             port;
    bool                            useSSL;
    struct sockaddr_in              address;
    int                             sd;
    SSL_CTX                         *sslContext;
    SSL                             *ssl;
    char                            code[26];
    char                            digest[30];
    bool                            wantActive;

    int                             (*onOpen)(RKReporter *);
    int                             (*onClose)(RKReporter *);
    int                             (*onError)(RKReporter *);
    int                             (*onMessage)(RKReporter *);
};


RKReporter *RKReporterInit(const char *radar, const char *host, const RKSSLFlag flag);
void RKReporterFree(RKReporter *reporter);

int RKReporterRead(RKReporter *reporter, void *buf, size_t size);
int RKReporterWrite(RKReporter *reporter, void *buf, size_t size);
