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
    char                     radar[16];
    char                     host[80];
    int                      port;
    bool                     useSSL;
    int                      verbose;

    int                      (*onOpen)(RKReporter *);
    int                      (*onClose)(RKReporter *);
    int                      (*onError)(RKReporter *);
    int                      (*onMessage)(RKReporter *);

    char                     ip[16];
    struct sockaddr_in       sa;                                 // Socket address
    int                      sd;                                 // Socket descriptor
    SSL_CTX                  *sslContext;
    SSL                      *ssl;
    char                     secret[26];
    char                     digest[30];
    bool                     wantActive;

    pthread_t                threadId;                           // Own thread ID
    pthread_attr_t           threadAttributes;                   // Thread attributes
    pthread_mutex_t          lock;                               // Thread safety mutex of the server

    fd_set                   rfd;                                // Read ready
    fd_set                   wfd;                                // Write ready
    fd_set                   efd;                                // Error occurred
};


RKReporter *RKReporterInit(const char *radar, const char *host, const RKSSLFlag);
void RKReporterFree(RKReporter *);

int RKReporterRead(RKReporter *, void *, size_t);
int RKReporterWrite(RKReporter *, void *, size_t);

void RKReporterSetOpenHandler(RKReporter *, int (*)(RKReporter *));
void RKReporterSetCloseHandler(RKReporter *, int (*)(RKReporter *));
void RKReporterSetMessageHandler(RKReporter *, int (*)(RKReporter *));
void RKReporterSetErrorHandler(RKReporter *, int (*)(RKReporter *));

void RKReporterRun(RKReporter *);
void RKReporterStop(RKReporter *);
