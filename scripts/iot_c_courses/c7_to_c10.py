"""Courses 7 to 10 for the Embedded IoT in C track."""

COURSE_7 = {
    "id": "iot-c-security",
    "version": 1,
    "order": 7,
    "title": "Embedded Security & TLS Cryptography with mbedTLS",
    "summary": "Protect connected edge devices using symmetric cryptography, HMAC-SHA256 message authentication, anti-replay nonce tracking, and memory-constrained TLS 1.3 with mbedTLS in C.",
    "difficulty": "Advanced",
    "minutes": 55,
    "codeExt": "c",
    "lessons": [
        {
            "id": "iot-c-sec-threats",
            "title": "IoT Threat Modeling, Root-of-Trust & Attack Vectors",
            "paragraphs": [
                "Connected IoT devices deployed in physical environments face hostile attack surfaces: physical disassembly, eavesdropping on unencrypted radio channels, Man-in-the-Middle (MitM) command injection, replay attacks where past legitimate commands are re-sent, and side-channel power analysis. A security breach in an industrial sensor node can compromise an entire factory SCADA system.",
                "Embedded security starts with a Hardware Root of Trust (RoT): immutable mask ROM containing the primary bootloader, hardware-burned eFuses storing unique device secret keys, and hardware cryptographic accelerators for AES, SHA, and Elliptic Curves (ECC). The Secure Boot chain ensures the CPU only executes firmware cryptographically signed by the vendor's private key."
            ],
            "example": "/* Conceptual Secure Boot verification flow in C */\nbool secure_boot_verify(const uint8_t *app_image, size_t img_len, const uint8_t *signature) {\n    uint8_t computed_hash[32];\n    hardware_sha256(app_image, img_len, computed_hash);\n    // Verify ECDSA signature against vendor public key burned in eFuses\n    return hardware_ecdsa_verify(s_vendor_public_key, computed_hash, signature);\n}",
            "pitfall": "Storing private cryptographic keys or Wi-Fi passwords in plain text in Flash memory. Anyone with physical access can read the Flash chip via SWD/JTAG or desoldering unless Flash Encryption is enabled.",
            "question": {
                "id": "q-iot-c-sec-1",
                "prompt": "What physical hardware mechanism prevents an attacker from extracting firmware and keys from an IoT microcontroller?",
                "options": [
                    {"id": "a", "text": "Hardware Flash Encryption using keys burned into one-time programmable eFuses, combined with disabling JTAG/SWD debug ports."},
                    {"id": "b", "text": "Increasing the microcontroller's CPU clock frequency."},
                    {"id": "c", "text": "Covering the circuit board with solder mask paint."}
                ],
                "answerId": "a",
                "explanation": "Hardware Flash encryption ensures data is encrypted at rest in Flash, while disabling JTAG/SWD prevents physical debugging tools from inspecting memory."
            }
        },
        {
            "id": "iot-c-sec-crypto",
            "title": "Symmetric Encryption & HMAC-SHA256 Authentication in C",
            "paragraphs": [
                "Symmetric cryptography uses the same secret key for encryption and decryption. For resource-constrained devices, Advanced Encryption Standard with Galois/Counter Mode (AES-128/256-GCM) is the gold standard because it provides Authenticated Encryption with Associated Data (AEAD): encrypting the plaintext while simultaneously computing an authentication tag that detects any byte tampering.",
                "When payloads do not require confidentiality but strictly require integrity and proof of origin, Hash-based Message Authentication Codes (HMAC-SHA256, RFC 2104) are utilized. HMAC hashes the message combined with inner (`ipad`) and outer (`opad`) padded secret keys. An attacker modifying a single temperature reading or command cannot generate a valid HMAC tag without knowing the secret key."
            ],
            "example": "// HMAC-SHA256 mathematical inner/outer key structure\n// HMAC(K, m) = H((K ^ opad) || H((K ^ ipad) || m))\n#define SHA256_BLOCK_SIZE 64\n#define HMAC_IPAD 0x36\n#define HMAC_OPAD 0x5C\n\nvoid hmac_sha256_init_pads(const uint8_t *key, size_t key_len, uint8_t *k_ipad, uint8_t *k_opad) {\n    uint8_t k[SHA256_BLOCK_SIZE] = {0};\n    memcpy(k, key, key_len < SHA256_BLOCK_SIZE ? key_len : SHA256_BLOCK_SIZE);\n    for (int i = 0; i < SHA256_BLOCK_SIZE; i++) {\n        k_ipad[i] = k[i] ^ HMAC_IPAD;\n        k_opad[i] = k[i] ^ HMAC_OPAD;\n    }\n}",
            "pitfall": "Using standard AES in Electronic Codebook (ECB) mode. ECB encrypts identical plaintext blocks into identical ciphertext blocks, preserving visual and structural patterns that attackers easily exploit.",
            "question": {
                "id": "q-iot-c-sec-2",
                "prompt": "Why is HMAC-SHA256 superior to a plain hash like SHA256(key + message)?",
                "options": [
                    {"id": "a", "text": "Plain SHA256(key + message) is vulnerable to Length Extension Attacks, whereas HMAC's nested hashing structure is mathematically immune."},
                    {"id": "b", "text": "HMAC requires half the CPU memory of SHA256."},
                    {"id": "c", "text": "HMAC automatically compresses the message into 4 bytes."}
                ],
                "answerId": "a",
                "explanation": "Length extension attacks allow adversaries to append data to an existing hash without knowing the secret key; HMAC's two-pass design completely eliminates this vulnerability."
            }
        },
        {
            "id": "iot-c-sec-mbedtls",
            "title": "Constrained TLS 1.3 with mbedTLS & X.509 Certificate Validation",
            "paragraphs": [
                "Transport Layer Security (TLS 1.3) protects TCP sockets against eavesdropping and tampering. Desktop browsers routinely allocate megabytes for TLS buffers. On an embedded microcontroller with 64 KB RAM, default TLS buffers (which mandate 16 KB for input and 16 KB for output) consume over half of total system memory!",
                "mbedTLS is specifically architected for microcontrollers. By negotiating the Maximum Fragment Length (MFL) TLS extension (`MBEDTLS_SSL_MAX_CONTENT_LEN`), buffer footprints shrink from 16 KB to 2 KB or 4 KB. During the TLS handshake, mbedTLS parses the server's X.509 certificate chain, verifies the cryptographic signature against the vendor's embedded Root CA certificate, and validates that current device time falls between the certificate's validity dates."
            ],
            "example": "/* Configuring mbedTLS with memory constraints in C */\nmbedtls_ssl_config conf;\nmbedtls_ssl_config_init(&conf);\nmbedtls_ssl_config_defaults(&conf, MBEDTLS_SSL_IS_CLIENT,\n                            MBEDTLS_SSL_TRANSPORT_STREAM,\n                            MBEDTLS_SSL_PRESET_DEFAULT);\n// Enforce strict certificate verification\nmbedtls_ssl_conf_authmode(&conf, MBEDTLS_SSL_VERIFY_REQUIRED);\nmbedtls_ssl_conf_ca_chain(&conf, &s_root_ca_cert, NULL);",
            "pitfall": "Configuring mbedTLS with `MBEDTLS_SSL_VERIFY_NONE`. Disabling certificate verification completely defeats TLS, exposing the device to trivial Man-in-the-Middle spoofing attacks.",
            "question": {
                "id": "q-iot-c-sec-3",
                "prompt": "How do embedded systems reduce mbedTLS memory requirements from 32 KB down to under 5 KB?",
                "options": [
                    {"id": "a", "text": "By enabling the TLS Maximum Fragment Length (MFL) extension to negotiate 2048-byte maximum record buffers."},
                    {"id": "b", "text": "By disabling cryptographic hashing."},
                    {"id": "c", "text": "By switching from TCP to raw analog signals."}
                ],
                "answerId": "a",
                "explanation": "The Maximum Fragment Length extension allows the client and server to agree on smaller TLS record buffers (down to 2048 bytes), saving tens of kilobytes of precious SRAM."
            }
        },
        {
            "id": "iot-c-sec-storage",
            "title": "Anti-Replay Protection & Memory Safety in C",
            "paragraphs": [
                "Even with encrypted communications, an adversary who records a valid signed packet (e.g. `UNLOCK_DOOR`) can replay it across the network hours later. Robust IoT protocols enforce Anti-Replay defenses using monotonic sequence numbers, timestamps, and a sliding-window nonce cache. If a packet arrives with a sequence number less than or equal to the highest verified sequence, it is discarded immediately.",
                "Memory safety bugs in C (buffer overflows, format string vulnerabilities, off-by-one errors) are the primary vector for Remote Code Execution (RCE) in connected devices. Defensive C coding strictly forbids unsafe functions like `strcpy()`, `sprintf()`, and `gets()`, mandating bounded alternatives (`snprintf()`, `memcpy()` with explicit length guards) and compiler stack-canary protections (`-fstack-protector-strong`)."
            ],
            "example": "// Anti-replay sequence verification in C\ntypedef struct {\n    uint32_t last_valid_sequence;\n} AntiReplayContext;\n\nbool verify_packet_sequence(AntiReplayContext *ctx, uint32_t packet_seq) {\n    if (packet_seq <= ctx->last_valid_sequence) {\n        return false; // Replay attempt detected!\n    }\n    ctx->last_valid_sequence = packet_seq;\n    return true;\n}",
            "pitfall": "Using `sprintf()` or `strcat()` to build JSON payloads or command strings. If sensor values or cloud messages exceed the buffer size, memory is overwritten, opening severe exploit vulnerabilities.",
            "question": {
                "id": "q-iot-c-sec-4",
                "prompt": "How does monotonic sequence number tracking prevent replay attacks in IoT command channels?",
                "options": [
                    {"id": "a", "text": "Each message must carry a strictly increasing sequence number; any packet with a repeated or stale sequence is rejected."},
                    {"id": "b", "text": "It converts commands into analog audio tones."},
                    {"id": "c", "text": "It requires the user to press a physical button on the board for every command."}
                ],
                "answerId": "a",
                "explanation": "By rejecting packets whose sequence number is not strictly greater than the last accepted number, previously recorded messages cannot be replayed."
            }
        }
    ],
    "steps": [
        "Study the embedded threat matrix and Hardware Root of Trust boot verification.",
        "Examine the pure C implementation of SHA-256 and HMAC-SHA256 message authentication.",
        "Inspect anti-replay sequence number verification and memory-safe buffer routines.",
        "Compile and execute `iot-c-security.c` with GCC: `gcc -std=c11 -Wall -Wextra iot-c-security.c -o iot-c-security`."
    ],
    "expected": "The program executes a pure C SHA-256 and HMAC-SHA256 calculation, verifies valid telemetry signatures, rejects forged payloads with altered temperature values, and catches simulated replay attacks.",
    "code": """#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

// Simple FIPS 180-4 compliant SHA-256 implementation
typedef struct {
    uint32_t state[8];
    uint64_t count;
    uint8_t buffer[64];
} MiniSHA256;

#define ROR(x, n) (((x) >> (n)) | ((x) << (32 - (n))))
#define CH(x, y, z) (((x) & (y)) ^ (~(x) & (z)))
#define MAJ(x, y, z) (((x) & (y)) ^ ((x) & (z)) ^ ((y) & (z)))
#define EP0(x) (ROR(x, 2) ^ ROR(x, 13) ^ ROR(x, 22))
#define EP1(x) (ROR(x, 6) ^ ROR(x, 11) ^ ROR(x, 25))
#define SIG0(x) (ROR(x, 7) ^ ROR(x, 18) ^ ((x) >> 3))
#define SIG1(x) (ROR(x, 17) ^ ROR(x, 19) ^ ((x) >> 10))

static const uint32_t K[64] = {
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
};

void sha256_transform(MiniSHA256 *ctx, const uint8_t data[64]) {
    uint32_t a, b, c, d, e, f, g, h, m[64];
    for (int i = 0, j = 0; i < 16; ++i, j += 4)
        m[i] = ((uint32_t)data[j] << 24) | ((uint32_t)data[j + 1] << 16) |
               ((uint32_t)data[j + 2] << 8) | ((uint32_t)data[j + 3]);
    for (int i = 16; i < 64; ++i)
        m[i] = SIG1(m[i - 2]) + m[i - 7] + SIG0(m[i - 15]) + m[i - 16];

    a = ctx->state[0]; b = ctx->state[1]; c = ctx->state[2]; d = ctx->state[3];
    e = ctx->state[4]; f = ctx->state[5]; g = ctx->state[6]; h = ctx->state[7];

    for (int i = 0; i < 64; ++i) {
        uint32_t t1 = h + EP1(e) + CH(e, f, g) + K[i] + m[i];
        uint32_t t2 = EP0(a) + MAJ(a, b, c);
        h = g; g = f; f = e; e = d + t1;
        d = c; c = b; b = a; a = t1 + t2;
    }

    ctx->state[0] += a; ctx->state[1] += b; ctx->state[2] += c; ctx->state[3] += d;
    ctx->state[4] += e; ctx->state[5] += f; ctx->state[6] += g; ctx->state[7] += h;
}

void sha256_init(MiniSHA256 *ctx) {
    ctx->state[0] = 0x6a09e667; ctx->state[1] = 0xbb67ae85;
    ctx->state[2] = 0x3c6ef372; ctx->state[3] = 0xa54ff53a;
    ctx->state[4] = 0x510e527f; ctx->state[5] = 0x9b05688c;
    ctx->state[6] = 0x1f83d9ab; ctx->state[7] = 0x5be0cd19;
    ctx->count = 0;
}

void sha256_update(MiniSHA256 *ctx, const uint8_t *data, size_t len) {
    for (size_t i = 0; i < len; ++i) {
        ctx->buffer[ctx->count % 64] = data[i];
        ctx->count++;
        if ((ctx->count % 64) == 0)
            sha256_transform(ctx, ctx->buffer);
    }
}

void sha256_final(MiniSHA256 *ctx, uint8_t hash[32]) {
    uint8_t pad = 0x80;
    uint64_t bit_count = ctx->count * 8;
    sha256_update(ctx, &pad, 1);
    pad = 0x00;
    while ((ctx->count % 64) != 56) sha256_update(ctx, &pad, 1);
    for (int i = 7; i >= 0; --i) {
        uint8_t b = (uint8_t)((bit_count >> (i * 8)) & 0xFF);
        sha256_update(ctx, &b, 1);
    }
    for (int i = 0; i < 8; ++i) {
        hash[i * 4]     = (uint8_t)(ctx->state[i] >> 24);
        hash[i * 4 + 1] = (uint8_t)(ctx->state[i] >> 16);
        hash[i * 4 + 2] = (uint8_t)(ctx->state[i] >> 8);
        hash[i * 4 + 3] = (uint8_t)(ctx->state[i] & 0xFF);
    }
}

void hmac_sha256(const uint8_t *key, size_t key_len, const uint8_t *msg, size_t msg_len, uint8_t out[32]) {
    uint8_t k_pad[64] = {0};
    if (key_len <= 64) memcpy(k_pad, key, key_len);
    uint8_t ipad[64], opad[64];
    for (int i = 0; i < 64; ++i) {
        ipad[i] = k_pad[i] ^ 0x36;
        opad[i] = k_pad[i] ^ 0x5c;
    }
    MiniSHA256 ctx;
    uint8_t inner_hash[32];
    sha256_init(&ctx);
    sha256_update(&ctx, ipad, 64);
    sha256_update(&ctx, msg, msg_len);
    sha256_final(&ctx, inner_hash);

    sha256_init(&ctx);
    sha256_update(&ctx, opad, 64);
    sha256_update(&ctx, inner_hash, 32);
    sha256_final(&ctx, out);
}

int main(void) {
    printf(\"[SECURITY] Embedded Cryptography & Anti-Replay Verification in C...\\n\");

    const uint8_t secret_key[16] = \"SecretDeviceKey1\";
    const char *telemetry_msg = \"SEQ:1001;DEVICE:vq-01;TEMP:26.5;HUM:58.2\";
    uint8_t hmac_sig[32];

    hmac_sha256(secret_key, 16, (const uint8_t *)telemetry_msg, strlen(telemetry_msg), hmac_sig);
    printf(\"[HMAC] Computed HMAC-SHA256 signature for telemetry (len=%zu):\\n  Tag: \", strlen(telemetry_msg));
    for (int i = 0; i < 8; i++) printf(\"%02X\", hmac_sig[i]);
    printf(\"... (32 bytes)\\n\");

    // Verify valid signature
    uint8_t verify_sig[32];
    hmac_sha256(secret_key, 16, (const uint8_t *)telemetry_msg, strlen(telemetry_msg), verify_sig);
    if (memcmp(hmac_sig, verify_sig, 32) != 0) {
        printf(\"[ERROR] Valid signature failed verification!\\n\");
        return 1;
    }
    printf(\"[STATUS] Authentic telemetry signature verified successfully.\\n\");

    // Tampered payload test
    const char *forged_msg = \"SEQ:1001;DEVICE:vq-01;TEMP:99.9;HUM:58.2\";
    hmac_sha256(secret_key, 16, (const uint8_t *)forged_msg, strlen(forged_msg), verify_sig);
    if (memcmp(hmac_sig, verify_sig, 32) == 0) {
        printf(\"[ERROR] Forged message passed signature check!\\n\");
        return 1;
    }
    printf(\"[SECURITY] Forged payload detected and rejected (HMAC mismatch).\\n\");

    // Anti-replay test
    uint32_t last_accepted_seq = 1001;
    uint32_t incoming_replayed_seq = 1001;
    if (incoming_replayed_seq <= last_accepted_seq) {
        printf(\"[SECURITY] Replay attack detected (SEQ %u <= last %u): packet discarded.\\n\",
               incoming_replayed_seq, last_accepted_seq);
    } else {
        printf(\"[ERROR] Replay attack was not blocked!\\n\");
        return 1;
    }

    printf(\"[STATUS] Cryptography, integrity check, and replay protection verified cleanly.\\n\");
    return 0;
}
""",
    "challenge": {
        "task": "Add a sliding window nonce cache in C that rejects duplicated packet identifiers within a 60-second window.",
        "acceptance": [
            "Implement a circular nonce array that records the last 16 received transaction IDs.",
            "Reject any message carrying an ID already present in the active window.",
            "Verify all buffer operations use bounded memcpy and snprintf functions."
        ]
    },
    "sources": [
        {"title": "mbed TLS Architecture and Source Code Guide", "url": "https://mbed-tls.readthedocs.io/en/latest/"},
        {"title": "RFC 2104: HMAC: Keyed-Hashing for Message Authentication", "url": "https://datatracker.ietf.org/doc/html/rfc2104"}
    ],
    "exam": {
        "passPercent": 80,
        "questions": [
            {
                "id": "q-iot-c-sec-exam-1",
                "prompt": "What vulnerability in plain SHA256(key + message) does HMAC prevent?",
                "options": [
                    {"id": "a", "text": "Length Extension Attacks, where an attacker appends data to a message and computes a valid hash without knowing the secret key."},
                    {"id": "b", "text": "Flash memory read latency."},
                    {"id": "c", "text": "UART baud rate framing errors."}
                ],
                "answerId": "a",
                "explanation": "Merkle-Damgard based hash functions like SHA-256 allow an attacker who knows the hash of (key || message) to append data and continue hashing. HMAC prevents this via two-pass nested hashing."
            },
            {
                "id": "q-iot-c-sec-exam-2",
                "prompt": "Why is AES in Galois/Counter Mode (AES-GCM) widely preferred for IoT device communications?",
                "options": [
                    {"id": "a", "text": "It provides Authenticated Encryption with Associated Data (AEAD), ensuring both confidentiality and cryptographic tampering detection."},
                    {"id": "b", "text": "It runs without requiring any CPU power."},
                    {"id": "c", "text": "It generates keys automatically without a pre-shared secret."}
                ],
                "answerId": "a",
                "explanation": "AES-GCM provides both encryption and an authentication tag in a single pass, guaranteeing that any modification to the ciphertext is caught."
            },
            {
                "id": "q-iot-c-sec-exam-3",
                "prompt": "What occurs during a Mutual TLS (mTLS) handshake that does NOT occur in standard one-way TLS?",
                "options": [
                    {"id": "a", "text": "The client must present its own X.509 client certificate to prove its device identity to the server."},
                    {"id": "b", "text": "The server transmits its private key to the client."},
                    {"id": "c", "text": "The TCP port switches from 443 to 80."}
                ],
                "answerId": "a",
                "explanation": "mTLS enforces bidirectional authentication: the server verifies the client's device certificate, ensuring only authorized IoT hardware can connect."
            },
            {
                "id": "q-iot-c-sec-exam-4",
                "prompt": "How does an anti-replay mechanism identify and reject intercepted packets that were captured and re-sent by an adversary?",
                "options": [
                    {"id": "a", "text": "By verifying that the packet's monotonic sequence number is strictly greater than the highest previously accepted sequence number."},
                    {"id": "b", "text": "By checking if the packet contains the word 'REPLAY'."},
                    {"id": "c", "text": "By asking the user to solve a CAPTCHA."}
                ],
                "answerId": "a",
                "explanation": "A monotonic sequence number increments on every message; replayed packets carry old or repeated numbers and are discarded."
            },
            {
                "id": "q-iot-c-sec-exam-5",
                "prompt": "Why are functions like `strcpy()` and `sprintf()` strictly prohibited in production embedded C code?",
                "options": [
                    {"id": "a", "text": "They do not perform destination buffer bounds-checking, creating critical buffer overflow vulnerabilities."},
                    {"id": "b", "text": "They are only available on 64-bit Linux machines."},
                    {"id": "c", "text": "They draw more electrical current from the battery."}
                ],
                "answerId": "a",
                "explanation": "Unbounded string functions copy characters until a null terminator is reached, easily overflowing fixed-size buffers into execution stacks and causing security exploits."
            }
        ]
    }
}

COURSE_8 = {
    "id": "iot-c-power",
    "version": 1,
    "order": 8,
    "title": "Low-Power IoT Design & Energy Harvesting",
    "summary": "Maximize battery lifetime in C using microcontroller sleep modes, RTC timer wakeups, RTC slow memory persistence, duty-cycle math, and brownout protection.",
    "difficulty": "Advanced",
    "minutes": 50,
    "codeExt": "c",
    "lessons": [
        {
            "id": "iot-c-pow-modes",
            "title": "Microcontroller Sleep Modes & Current Draw Profiles",
            "paragraphs": [
                "For battery-powered field sensors (agricultural probes, asset trackers, structural monitors), replacing batteries every few weeks is economically unviable. Production devices are engineered for 5 to 10 years of battery life on a single cell. Microcontrollers achieve this by supporting distinct power domains: Active (CPU and all clocks running, drawing 20–80 mA), Light Sleep (CPU clock gated, RAM retained, ~1 mA), and Deep Sleep (CPU, high-speed oscillators, and main RAM unpowered; only the low-power RTC timer and RTC memory active, drawing 5–15 µA).",
                "The core engineering discipline is Duty Cycling: keeping the device in Deep Sleep for 99.9% of its lifetime and waking for only tens of milliseconds to sample sensors and transmit bursts. Minimizing active duration $t_{active}$ has a far greater impact on battery lifetime than CPU clock speed."
            ],
            "example": "// Deep sleep transition in embedded C (ESP-IDF / Cortex-M)\nvoid enter_deep_sleep(uint64_t sleep_time_us) {\n    printf(\"[POWER] Entering deep sleep for %llu ms...\\n\", sleep_time_us / 1000ULL);\n    // 1. Configure RTC wake timer\n    esp_sleep_enable_timer_wakeup(sleep_time_us);\n    // 2. Isolate GPIO pins to prevent leakage currents\n    rtc_gpio_isolate(GPIO_NUM_12);\n    // 3. Enter deep sleep (CPU and RAM power down)\n    esp_deep_sleep_start();\n}",
            "pitfall": "Leaving GPIO pins floating before entering deep sleep. Floating digital inputs drift between logic levels, causing parasitic CMOS leakage currents that drain batteries hundreds of times faster than expected.",
            "question": {
                "id": "q-iot-c-pow-1",
                "prompt": "Why must all unused or inactive GPIO pins be pulled up, pulled down, or isolated before entering deep sleep?",
                "options": [
                    {"id": "a", "text": "Floating pins pick up ambient noise and toggle intermediate logic levels, causing high parasitic leakage current through CMOS input transistors."},
                    {"id": "b", "text": "Floating pins will corrupt the compiler's object code in Flash."},
                    {"id": "c", "text": "Floating pins cause the Wi-Fi antenna to overheat."}
                ],
                "answerId": "a",
                "explanation": "In CMOS circuits, an input floating between 0V and VDD causes both NMOS and PMOS transistors to partially conduct simultaneously, bleeding current directly to ground."
            }
        },
        {
            "id": "iot-c-pow-rtc",
            "title": "Wakeup Sources & RTC Slow Memory Persistence",
            "paragraphs": [
                "When a microcontroller awakens from Deep Sleep, the main CPU undergoes a hardware reset: main SRAM contents are lost, the reset vector executes, and the C runtime re-initializes `.data` and `.bss`. Storing operational state (boot count, cumulative sensor averages, Wi-Fi channel and BSSID) in Flash on every wake cycle is forbidden because Flash has a limited write endurance (~100,000 cycles) and high erase energy.",
                "Instead, modern SoCs provide dedicated low-power RTC Fast/Slow SRAM (e.g. 8 KB) that remains powered during Deep Sleep by the ultra-low-power RTC power rail. In C, variables tagged with special attributes (`RTC_DATA_ATTR` on ESP32 or custom linker sections) retain their values across sleep resets, enabling fast wake cycles without Flash writes or Wi-Fi channel scans."
            ],
            "example": "// Preserving state across deep sleep resets without Flash wear\n#define RTC_DATA_ATTR __attribute__((section(\".rtc.data\")))\n\nRTC_DATA_ATTR static uint32_t s_boot_count = 0;\nRTC_DATA_ATTR static uint8_t s_saved_wifi_channel = 6;\n\nvoid app_main(void) {\n    s_boot_count++;\n    printf(\"[RTC] Wake count: %u. Using saved channel: %u\\n\",\n           s_boot_count, s_saved_wifi_channel);\n    // Proceed directly to connection on known channel without 3-second full scan\n}",
            "pitfall": "Assuming standard static/global variables retain their values across deep sleep cycles. Without explicit RTC memory section attributes, globals are re-initialized to zero by startup code on wake.",
            "question": {
                "id": "q-iot-c-pow-2",
                "prompt": "Why is RTC slow memory preferred over Flash memory for storing state between deep sleep cycles?",
                "options": [
                    {"id": "a", "text": "RTC RAM requires near-zero energy to write and has infinite write endurance, avoiding Flash wear-out and high erase currents."},
                    {"id": "b", "text": "RTC RAM can only be read by hardware DMA."},
                    {"id": "c", "text": "Flash memory cannot store integer variables."}
                ],
                "answerId": "a",
                "explanation": "Writing to Flash requires high-voltage charge pumps and wears out physical silicon oxide layers. RTC RAM writes are instant, low-power, and endure infinite cycles."
            }
        },
        {
            "id": "iot-c-pow-budget",
            "title": "Duty-Cycle Energy Math & Battery Lifespan Calculation",
            "paragraphs": [
                "Accurate battery lifetime estimation requires calculating the weighted average current consumption ($I_{avg}$) over the repeating operational cycle: $I_{avg} = \\frac{(I_{active} \\times t_{active}) + (I_{sleep} \\times t_{sleep})}{t_{active} + t_{sleep}}$.",
                "Consider a sensor node waking every 60 seconds ($T = 60\\text{ s}$): Active phase takes 150 ms ($0.15\\text{ s}$) at $I_{active} = 40\\text{ mA}$; Sleep phase takes 59.85 s at $I_{sleep} = 10\\text{ }\\mu\\text{A}$ ($0.01\\text{ mA}$). Average current is $I_{avg} = \\frac{(40 \\times 0.15) + (0.01 \\times 59.85)}{60} = \\frac{6.0 + 0.5985}{60} \\approx 0.11\\text{ mA}$. On a standard 2400 mAh battery (with a safety derating factor of $\\eta = 0.85$ yielding 2040 mAh usable capacity), runtime is $\\frac{2040}{0.11} = 18,545\\text{ hours} \\approx 2.11\\text{ years}$."
            ],
            "example": "// Battery life calculation in C\nfloat calculate_battery_life_years(float i_active_ma, float t_active_sec,\n                                   float i_sleep_ma, float t_sleep_sec,\n                                   float battery_capacity_mah) {\n    float t_cycle = t_active_sec + t_sleep_sec;\n    float i_avg_ma = ((i_active_ma * t_active_sec) + (i_sleep_ma * t_sleep_sec)) / t_cycle;\n    float usable_capacity = battery_capacity_mah * 0.85f; // 85% derating\n    float hours = usable_capacity / i_avg_ma;\n    return hours / (24.0f * 365.25f);\n}",
            "pitfall": "Ignoring battery self-discharge and temperature degradation. Real batteries lose 1–2% capacity per year on the shelf, and cold temperatures drop usable capacity significantly.",
            "question": {
                "id": "q-iot-c-pow-3",
                "prompt": "If a device spends 100 ms in active mode at 50 mA and 9.9 seconds in deep sleep at 0.01 mA (10 uA), what is the average current consumption over the 10-second cycle?",
                "options": [
                    {"id": "a", "text": "Approximately 0.51 mA"},
                    {"id": "b", "text": "50.0 mA"},
                    {"id": "c", "text": "0.01 mA"}
                ],
                "answerId": "a",
                "explanation": "Active charge = 50 mA * 0.1 s = 5.0 mAs. Sleep charge = 0.01 mA * 9.9 s = 0.099 mAs. Total charge = 5.099 mAs. Average current = 5.099 mAs / 10 s = 0.5099 mA (~0.51 mA)."
            }
        },
        {
            "id": "iot-c-pow-harvest",
            "title": "Brownout Detection (BOD) & Power-Fail Early Warnings",
            "paragraphs": [
                "When a battery nears depletion or cold weather increases internal resistance, a sudden high-current radio transmission can cause battery voltage ($V_{DD}$) to sag sharply. If $V_{DD}$ drops below the CPU's minimum operating threshold while writing to Flash, memory sectors will be permanently corrupted.",
                "Microcontrollers incorporate hardware Brown-Out Detectors (BOD) or Programmable Voltage Detectors (PVD). The BOD monitors supply rails and triggers an early-warning interrupt when voltage falls below a programmable safety threshold (e.g. 2.7V). The C brownout ISR immediately halts radio transmissions, aborts Flash writes, flushes emergency crash state to RTC memory, and enters emergency low-power shutdown."
            ],
            "example": "// Brown-out early warning ISR in C\nvoid PVD_IRQHandler(void) {\n    // Supply voltage dropped below 2.7V!\n    disable_radio_transmitters();\n    abort_flash_operations();\n    s_rtc_emergency_shutdown_flag = 1;\n    enter_deep_sleep(UINT64_MAX); // Sleep indefinitely until battery replaced\n}",
            "pitfall": "Attempting to perform a synchronous Flash erase or write inside a brownout ISR. Erasing Flash draws significant current, accelerating voltage collapse and guaranteeing memory corruption.",
            "question": {
                "id": "q-iot-c-pow-4",
                "prompt": "What should an embedded Brown-Out Detector (BOD) ISR immediately do when supply voltage drops below the safety threshold?",
                "options": [
                    {"id": "a", "text": "Halt high-current peripherals (radio/motors), abort Flash writes, and enter low-power sleep to prevent memory corruption."},
                    {"id": "b", "text": "Format the file system and increase the CPU clock frequency."},
                    {"id": "c", "text": "Transmit an uncompressed high-resolution camera image."}
                ],
                "answerId": "a",
                "explanation": "The brownout interrupt is an emergency alert that voltage is collapsing. The MCU must instantly cut current draw and stop Flash programming before the CPU crashes."
            }
        }
    ],
    "steps": [
        "Study microcontroller sleep state current profiles (Active, Light Sleep, Deep Sleep).",
        "Inspect RTC memory persistence across hardware resets without Flash wear.",
        "Analyze duty-cycle battery lifetime math and average current formulas.",
        "Compile and execute `iot-c-power.c` with GCC: `gcc -std=c11 -Wall -Wextra iot-c-power.c -o iot-c-power`."
    ],
    "expected": "The program simulates a remote environmental sensor node executing 1440 duty-cycle iterations, updates simulated RTC persistent memory, calculates exact average current consumption, and projects battery life in years.",
    "code": """#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

typedef struct {
    uint32_t boot_count;
    float last_temperature;
    uint32_t total_sleep_seconds;
} MockRTC_Memory;

static MockRTC_Memory s_rtc_ram = { .boot_count = 0, .last_temperature = 0.0f, .total_sleep_seconds = 0 };

float simulate_duty_cycle(float i_active_ma, float t_active_s,
                         float i_sleep_ma, float t_sleep_s,
                         float battery_mah, uint32_t cycles) {
    float cycle_time = t_active_s + t_sleep_s;
    float active_charge_mas = i_active_ma * t_active_s;
    float sleep_charge_mas = i_sleep_ma * t_sleep_s;
    float total_cycle_charge = active_charge_mas + sleep_charge_mas;
    float i_avg_ma = total_cycle_charge / cycle_time;

    for (uint32_t i = 0; i < cycles; i++) {
        s_rtc_ram.boot_count++;
        s_rtc_ram.last_temperature = 22.0f + (float)(i % 5);
        s_rtc_ram.total_sleep_seconds += (uint32_t)t_sleep_s;
    }

    float usable_capacity = battery_mah * 0.85f; // 85% safety factor
    float hours = usable_capacity / i_avg_ma;
    return hours / (24.0f * 365.25f);
}

int main(void) {
    printf(\"[POWER] Low-Power IoT Duty-Cycle & RTC Persistence Simulator...\\n\");

    // Profile: Active 120 ms @ 35 mA; Deep Sleep 59.88 s @ 0.012 mA (12 uA)
    float i_active = 35.0f; // mA
    float t_active = 0.12f; // seconds (120 ms)
    float i_sleep = 0.012f; // mA (12 uA)
    float t_sleep = 59.88f; // seconds
    float battery_capacity = 2400.0f; // mAh Li-SOCl2 cell

    printf(\"[PROFILE] Active: %.1f mA for %.0f ms | Sleep: %.3f mA for %.2f s\\n\",
           i_active, t_active * 1000.0f, i_sleep, t_sleep);

    float years = simulate_duty_cycle(i_active, t_active, i_sleep, t_sleep, battery_capacity, 1440);

    float cycle_t = t_active + t_sleep;
    float avg_ma = ((i_active * t_active) + (i_sleep * t_sleep)) / cycle_t;

    printf(\"[METRICS] Simulated 1,440 wake cycles (24 hours):\\n\");
    printf(\"  RTC Boot Count: %u\\n\", s_rtc_ram.boot_count);
    printf(\"  RTC Total Sleep Logged: %u seconds\\n\", s_rtc_ram.total_sleep_seconds);
    printf(\"  Average Current Consumption: %.4f mA (%.1f uA)\\n\", avg_ma, avg_ma * 1000.0f);
    printf(\"  Projected Battery Lifespan: %.2f years\\n\", years);

    if (avg_ma > 0.15f || years < 1.5f) {
        printf(\"[ERROR] Energy budget exceeded target threshold!\\n\");
        return 1;
    }

    printf(\"[STATUS] Low-power sleep states and RTC persistence verified cleanly.\\n\");
    return 0;
}
""",
    "challenge": {
        "task": "Add an adaptive duty-cycle controller in C that doubles the sleep interval when simulated battery voltage falls below 3.0V.",
        "acceptance": [
            "Implement a voltage monitor that triggers sleep interval expansion from 60s to 120s when voltage drops.",
            "Record the power savings ratio achieved under low-battery mode.",
            "Verify RTC memory maintains state consistency across power state transitions."
        ]
    },
    "sources": [
        {"title": "TI Application Note: Low-Power Design Guide for Microcontrollers", "url": "https://www.ti.com/lit/an/slaa322/slaa322.pdf"},
        {"title": "Espressif Low Power Management & Deep Sleep Documentation", "url": "https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/sleep_modes.html"}
    ],
    "exam": {
        "passPercent": 80,
        "questions": [
            {
                "id": "q-iot-c-pow-exam-1",
                "prompt": "What major subsystems remain powered during Microcontroller Deep Sleep mode?",
                "options": [
                    {"id": "a", "text": "Only the low-frequency RTC timer, wakeup logic, and low-power RTC slow memory."},
                    {"id": "b", "text": "The main CPU core and high-speed Wi-Fi radio."},
                    {"id": "c", "text": "The full 320 KB internal SRAM and Flash programming charge pump."}
                ],
                "answerId": "a",
                "explanation": "Deep sleep powers down the CPU and main RAM, leaving only ultra-low-power RTC timers and small battery-backed RTC memory active to draw microamps."
            },
            {
                "id": "q-iot-c-pow-exam-2",
                "prompt": "Why should persistent operational counters be stored in RTC RAM rather than Flash during periodic sleep wakeups?",
                "options": [
                    {"id": "a", "text": "Flash has finite write cycle endurance (~100k cycles) and requires high erase current, while RTC RAM has infinite endurance and near-zero write energy."},
                    {"id": "b", "text": "RTC RAM is 100 times larger than Flash memory."},
                    {"id": "c", "text": "Flash memory cannot be written in C."}
                ],
                "answerId": "a",
                "explanation": "Frequent Flash writes wear out silicon oxide layers and consume significant energy. RTC RAM can be updated millions of times without wear."
            },
            {
                "id": "q-iot-c-pow-exam-3",
                "prompt": "If a device draws 30 mA during a 100 ms active burst and 10 uA (0.01 mA) during 59.9 seconds of sleep, what is the average current over the 60s period?",
                "options": [
                    {"id": "a", "text": "0.060 mA (60 uA)"},
                    {"id": "b", "text": "30.0 mA"},
                    {"id": "c", "text": "0.010 mA"}
                ],
                "answerId": "a",
                "explanation": "Active charge = 30 mA * 0.1 s = 3.0 mAs. Sleep charge = 0.01 mA * 59.9 s = 0.599 mAs. Total charge = 3.599 mAs. Average current = 3.599 / 60 s = 0.05998 mA (~0.06 mA)."
            },
            {
                "id": "q-iot-c-pow-exam-4",
                "prompt": "What is the primary danger of leaving an unused GPIO pin in a floating input state during sleep?",
                "options": [
                    {"id": "a", "text": "The input voltage drifts between logic thresholds, causing continuous CMOS shoot-through leakage current directly to ground."},
                    {"id": "b", "text": "The CPU core executes invalid machine instructions."},
                    {"id": "c", "text": "The RTC timer clock frequency doubles."}
                ],
                "answerId": "a",
                "explanation": "Floating inputs float to intermediate voltages where both complimentary input transistors turn partially on, bleeding battery current directly to GND."
            },
            {
                "id": "q-iot-c-pow-exam-5",
                "prompt": "What action should an embedded Brown-Out Detector interrupt prioritize?",
                "options": [
                    {"id": "a", "text": "Aborting Flash writes and disabling high-current loads to prevent memory corruption as voltage collapses."},
                    {"id": "b", "text": "Overclocking the CPU to finish the task faster."},
                    {"id": "c", "text": "Transmitting all stored logs over Wi-Fi."}
                ],
                "answerId": "a",
                "explanation": "When battery voltage sags below safety limits, the MCU must immediately halt Flash writes and high loads to avoid catastrophic data corruption."
            }
        ]
    }
}

COURSE_9 = {
    "id": "iot-c-ota",
    "version": 1,
    "order": 9,
    "title": "Over-the-Air (OTA) Firmware Updates & Storage",
    "summary": "Implement fail-safe dual-bank (A/B) OTA firmware updates in C with image header validation, SHA-256 verification, bootloader slot switching, and automated rollback guards.",
    "difficulty": "Advanced",
    "minutes": 55,
    "codeExt": "c",
    "lessons": [
        {
            "id": "iot-c-ota-partitions",
            "title": "Flash Partition Tables & Dual-Bank (A/B) Architecture",
            "paragraphs": [
                "Over-The-Air (OTA) firmware updates allow deployed IoT devices to receive bug fixes and feature enhancements remotely. Updating a single in-place firmware slot is hazardous: if power cuts or network drops mid-transfer, the Flash contains half an image and the device is permanently bricked.",
                "Production embedded architectures mandate a Dual-Bank (A/B) Partition Scheme. Flash is divided into: Bootloader, Partition Table, Non-Volatile Storage (NVS), `ota_0` (Slot A), `ota_1` (Slot B), and `otadata` (metadata tracking which slot is active). The currently running application streams the new firmware image into the idle, inactive partition. The active slot is never modified during download."
            ],
            "example": "/* Standard dual-bank partition table layout (*.csv) */\n# Name,   Type, SubType, Offset,   Size\nnvs,      data, nvs,     0x9000,   0x4000\notadata,  data, ota,     0xd000,   0x2000\nphy_init, data, phy,     0xf000,   0x1000\nota_0,    app,  ota_0,   0x10000,  0x180000\nota_1,    app,  ota_1,   0x190000, 0x180000",
            "pitfall": "Flashing new firmware directly into the currently executing partition. Any network timeout or power interruption leaves the device in an unbootable bricked state requiring physical disassembly.",
            "question": {
                "id": "q-iot-c-ota-1",
                "prompt": "Why is a dual-bank (A/B) partition scheme mandatory for remote IoT firmware updates?",
                "options": [
                    {"id": "a", "text": "It writes new firmware into the inactive slot while the active slot keeps running, preventing device bricking if the update is interrupted."},
                    {"id": "b", "text": "It doubles the radio transmission speed of the Wi-Fi modem."},
                    {"id": "c", "text": "It allows the microcontroller to execute two C programs simultaneously on one core."}
                ],
                "answerId": "a",
                "explanation": "If a download is interrupted or the downloaded binary is corrupted, the device continues running the existing, proven firmware in the other slot."
            }
        },
        {
            "id": "iot-c-ota-headers",
            "title": "Firmware Image Headers, Magic Bytes & Integrity Verification",
            "paragraphs": [
                "A raw binary file should never be flashed directly to execution slots without encapsulation. Production build pipelines prepend a structured Binary Image Header containing: Magic Word (e.g. `0xE765`), Header Version, Target Hardware ID, Firmware Version (Semantic Versioning), Payload Size, and a SHA-256 cryptographic digest.",
                "During download, the OTA manager parses the header first: if the magic word or hardware ID does not match the physical board, the update is rejected immediately before burning Flash sectors. As payload chunks stream across the network, they are fed into an incremental SHA-256 hash context (`sha256_update`). When download concludes, the final hash must match the header digest."
            ],
            "example": "// Structured OTA Image Header in C\ntypedef struct {\n    uint32_t magic_word;      // 0xE765A55A\n    uint32_t image_version;   // e.g. 0x00020100 (v2.1.0)\n    uint32_t target_chip_id;  // Hardware model identifier\n    uint32_t payload_bytes;   // Exact size of binary\n    uint8_t  sha256[32];      // Cryptographic hash of image\n    uint8_t  signature[64];   // ECDSA signature for secure boot\n} __attribute__((packed)) OtaImageHeader;",
            "pitfall": "Calculating the SHA-256 checksum after writing the whole image to Flash without verifying during download. Verifying chunk-by-chunk detects corruption early and aborts before wasting write cycles.",
            "question": {
                "id": "q-iot-c-ota-2",
                "prompt": "What purpose does the Magic Word field serve in an embedded firmware image header?",
                "options": [
                    {"id": "a", "text": "It acts as a distinctive signature confirming the binary is an authentic firmware image intended for this platform."},
                    {"id": "b", "text": "It stores the Wi-Fi password in encrypted format."},
                    {"id": "c", "text": "It instructs the compiler to enable debug symbols."}
                ],
                "answerId": "a",
                "explanation": "The magic word is a fixed multi-byte constant verified at the beginning of the download to instantly reject non-firmware files or incompatible formats."
            }
        },
        {
            "id": "iot-c-ota-rollback",
            "title": "Bootloader Slot Switching & Automatic Rollback Protection",
            "paragraphs": [
                "Even if a new firmware image passes SHA-256 verification, it might contain a severe software bug (e.g., crashing before establishing Wi-Fi, entering a deadlock, or crashing in a loop). Without defensive design, the device will never reconnect to the cloud, bricking remote recovery.",
                "The solution is Automatic Rollback: when the update completes, `otadata` sets the new slot's state to `ESP_OTA_IMG_PENDING_VERIFY`. Upon reboot, the bootloader starts a hardware watchdog timer and boots the new image. The new application must perform self-diagnostics (connecting to Wi-Fi, pinging the cloud) and call `ota_mark_valid()`. If the app crashes, reboots in a loop, or the watchdog fires before validation, the bootloader automatically rolls back to the previous known-good partition."
            ],
            "example": "// Application self-diagnostic and rollback confirmation\nvoid app_main(void) {\n    if (ota_get_state() == OTA_STATE_PENDING_VERIFY) {\n        printf(\"[OTA] First boot after update! Running self-diagnostics...\\n\");\n        if (test_network_connection() && test_sensors()) {\n            printf(\"[OTA] Diagnostics passed! Confirming firmware as permanent valid.\\n\");\n            ota_mark_valid();\n        } else {\n            printf(\"[OTA] Diagnostics failed! Triggering automatic rollback...\\n\");\n            ota_rollback_and_reboot();\n        }\n    }\n}",
            "pitfall": "Calling `ota_mark_valid()` immediately at the start of `main()` before testing network connectivity. If the firmware connects to incorrect Wi-Fi credentials or crashes inside the network stack, recovery is lost.",
            "question": {
                "id": "q-iot-c-ota-3",
                "prompt": "When should an updated firmware application invoke `ota_mark_valid()`?",
                "options": [
                    {"id": "a", "text": "Only after self-diagnostics confirm that critical network connectivity and hardware subsystems are functioning properly."},
                    {"id": "b", "text": "On the very first line of the reset vector before the C runtime initializes."},
                    {"id": "c", "text": "Immediately before erasing the inactive partition."}
                ],
                "answerId": "a",
                "explanation": "Marking valid commits the update permanently. It must only be called after verifying that communication is working, preserving rollback safety if the new code fails."
            }
        },
        {
            "id": "iot-c-ota-nvs",
            "title": "Non-Volatile Storage (NVS) & Flash Wear Leveling in C",
            "paragraphs": [
                "Unlike RAM, Flash memory is write-once, erase-many: individual bits can be changed from 1 to 0, but changing 0s back to 1s requires erasing an entire 4096-byte sector. Frequently rewriting configuration parameters (MQTT client ID, calibration offsets, Wi-Fi keys) to the same Flash address burns out sectors quickly.",
                "Non-Volatile Storage (NVS) libraries provide log-structured, key-value storage across designated Flash sectors. When a key is updated, NVS marks the old entry as invalid and appends the new value to the next free page. Wear Leveling algorithms distribute writes across physical sectors, ensuring no single flash block wears out prematurely."
            ],
            "example": "// NVS key-value storage pattern in embedded C\nvoid save_calibration_offset(float offset) {\n    nvs_handle_t my_handle;\n    nvs_open(\"storage\", NVS_READWRITE, &my_handle);\n    nvs_set_blob(my_handle, \"cal_offset\", &offset, sizeof(offset));\n    nvs_commit(my_handle); // Flush write to active sector page\n    nvs_close(my_handle);\n}",
            "pitfall": "Erasing and re-writing entire Flash sectors on every sensor reading. NOR Flash sectors degrade after ~100k cycles; writing every second destroys flash memory in roughly 27 hours.",
            "question": {
                "id": "q-iot-c-ota-4",
                "prompt": "How does log-structured Non-Volatile Storage (NVS) protect Flash memory from premature hardware burnout?",
                "options": [
                    {"id": "a", "text": "It appends updates to new pages and distributes writes across sectors via wear-leveling instead of repeatedly erasing the same physical sector."},
                    {"id": "b", "text": "It cools the Flash chip using CPU clock gating."},
                    {"id": "c", "text": "It converts Flash sectors into dynamic RAM blocks."}
                ],
                "answerId": "a",
                "explanation": "Log-structured storage avoids immediate sector erasures by writing sequentially and performing wear leveling, extending Flash lifespan from days to decades."
            }
        }
    ],
    "steps": [
        "Study the dual-bank partition table layout and `otadata` slot switching state machine.",
        "Examine the structured OTA image header format and SHA-256 streaming verification in C.",
        "Inspect the bootloader automated rollback logic on diagnostic test failure.",
        "Compile and execute `iot-c-ota.c` with GCC: `gcc -std=c11 -Wall -Wextra iot-c-ota.c -o iot-c-ota`."
    ],
    "expected": "The program simulates staging an OTA update into Slot B, validates header magic bytes and image version, computes SHA-256 integrity, demonstrates a simulated crash triggering rollback to Slot A, and executes a successful update marked valid.",
    "code": """#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

#define OTA_MAGIC_WORD  0xE765A55AU

typedef enum {
    OTA_SLOT_A = 0,
    OTA_SLOT_B = 1
} OtaSlot;

typedef enum {
    SLOT_STATE_VALID,
    SLOT_STATE_PENDING_VERIFY,
    SLOT_STATE_ROLLBACK
} SlotState;

typedef struct {
    uint32_t magic;
    uint32_t version;
    uint32_t size;
    uint32_t checksum;
} OtaImageHeader;

typedef struct {
    OtaSlot active_slot;
    SlotState slot_state;
    uint32_t current_version;
} OtaControlData;

static OtaControlData s_otadata = {
    .active_slot = OTA_SLOT_A,
    .slot_state = SLOT_STATE_VALID,
    .current_version = 0x00010000 // v1.0.0
};

uint32_t compute_checksum(const uint8_t *data, size_t len) {
    uint32_t sum = 0;
    for (size_t i = 0; i < len; i++) sum += data[i];
    return sum;
}

bool stage_ota_update(OtaSlot target_slot, const OtaImageHeader *hdr, const uint8_t *payload) {
    printf(\"[OTA] Staging update into inactive Slot %s...\\n\",
           target_slot == OTA_SLOT_A ? \"A\" : \"B\");

    // 1. Validate Magic Word
    if (hdr->magic != OTA_MAGIC_WORD) {
        printf(\"[ERROR] Invalid OTA image magic word: 0x%08X!\\n\", hdr->magic);
        return false;
    }

    // 2. Validate Anti-Rollback (version must be >= current)
    if (hdr->version <= s_otadata.current_version) {
        printf(\"[ERROR] Anti-Rollback triggered: version 0x%08X <= current 0x%08X\\n\",
               hdr->version, s_otadata.current_version);
        return false;
    }

    // 3. Verify payload integrity
    uint32_t calculated_cs = compute_checksum(payload, hdr->size);
    if (calculated_cs != hdr->checksum) {
        printf(\"[ERROR] Image checksum mismatch: calculated 0x%08X != expected 0x%08X\\n\",
               calculated_cs, hdr->checksum);
        return false;
    }

    // 4. Switch slot and mark PENDING_VERIFY
    s_otadata.active_slot = target_slot;
    s_otadata.slot_state = SLOT_STATE_PENDING_VERIFY;
    s_otadata.current_version = hdr->version;
    printf(\"[OTA] Staged successfully. Active slot switched to %s (PENDING_VERIFY)\\n\",
           target_slot == OTA_SLOT_A ? \"A\" : \"B\");
    return true;
}

void bootloader_boot_cycle(bool self_test_passes) {
    printf(\"[BOOTLOADER] Reset detected. Inspecting otadata...\\n\");
    printf(\"  Active Slot: %s | State: %s\\n\",
           s_otadata.active_slot == OTA_SLOT_A ? \"A\" : \"B\",
           s_otadata.slot_state == SLOT_STATE_PENDING_VERIFY ? \"PENDING_VERIFY\" : \"VALID\");

    if (s_otadata.slot_state == SLOT_STATE_PENDING_VERIFY) {
        printf(\"[BOOTLOADER] Running newly updated firmware self-diagnostics...\\n\");
        if (self_test_passes) {
            s_otadata.slot_state = SLOT_STATE_VALID;
            printf(\"[BOOTLOADER] Diagnostics passed! Firmware marked permanently VALID.\\n\");
        } else {
            // Rollback to alternate slot and restore proven version
            s_otadata.active_slot = (s_otadata.active_slot == OTA_SLOT_A) ? OTA_SLOT_B : OTA_SLOT_A;
            s_otadata.slot_state = SLOT_STATE_VALID;
            s_otadata.current_version = 0x00010000;
            printf(\"[BOOTLOADER] Diagnostics FAILED! Triggering automated ROLLBACK to Slot %s\\n\",
                   s_otadata.active_slot == OTA_SLOT_A ? \"A\" : \"B\");
        }
    }
}

int main(void) {
    printf(\"[OTA] Dual-Bank (A/B) Firmware Partition Manager Simulator...\\n\");

    const uint8_t mock_binary[20] = \"FIRMWARE_V2.0.0!\";
    OtaImageHeader valid_header = {
        .magic = OTA_MAGIC_WORD,
        .version = 0x00020000, // v2.0.0
        .size = 16,
        .checksum = compute_checksum(mock_binary, 16)
    };

    // Test 1: Stage update into Slot B
    bool ok = stage_ota_update(OTA_SLOT_B, &valid_header, mock_binary);
    if (!ok) return 1;

    // Test 2: Simulate failure triggering automated rollback
    printf(\"\\n--- SCENARIO 1: Faulty firmware causes crash on first boot ---\\n\");
    bootloader_boot_cycle(false);
    if (s_otadata.active_slot != OTA_SLOT_A) {
        printf(\"[ERROR] Rollback failed to revert to Slot A!\\n\");
        return 1;
    }
    printf(\"[VERIFIED] Successfully rolled back to working Slot A.\\n\");

    // Test 3: Stage valid update again and verify permanent activation
    printf(\"\\n--- SCENARIO 2: Bug-fixed firmware passes diagnostics ---\\n\");
    stage_ota_update(OTA_SLOT_B, &valid_header, mock_binary);
    bootloader_boot_cycle(true);
    if (s_otadata.active_slot != OTA_SLOT_B || s_otadata.slot_state != SLOT_STATE_VALID) {
        printf(\"[ERROR] Failed to permanently confirm valid Slot B!\\n\");
        return 1;
    }
    printf(\"[VERIFIED] New firmware v2.0.0 active and confirmed permanently.\\n\");

    printf(\"[STATUS] Dual-bank OTA updates and automated rollback guards verified cleanly.\\n\");
    return 0;
}
""",
    "challenge": {
        "task": "Add semantic version parsing logic that prevents downgrade attacks to older firmware versions.",
        "acceptance": [
            "Implement a version comparison function verifying major, minor, and patch numbers.",
            "Reject any image whose version is lower than the currently running build.",
            "Verify the partition manager handles corrupted image headers without changing bootloader state."
        ]
    },
    "sources": [
        {"title": "ESP32 OTA Update & Rollback Mechanism Documentation", "url": "https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/ota.html"},
        {"title": "ARM Mbed OS Over-the-Air Firmware Update Architecture", "url": "https://os.mbed.com/docs/mbed-os/v6.15/apis/firmware-update.html"}
    ],
    "exam": {
        "passPercent": 80,
        "questions": [
            {
                "id": "q-iot-c-ota-exam-1",
                "prompt": "What primary hazard does a Dual-Bank (A/B) OTA partition layout eliminate?",
                "options": [
                    {"id": "a", "text": "Permanent device bricking caused by an interrupted download or power cut during flashing."},
                    {"id": "b", "text": "The need for external Wi-Fi antennas."},
                    {"id": "c", "text": "CPU memory cache misses."}
                ],
                "answerId": "a",
                "explanation": "By flashing the inactive slot, an interrupted update leaves the active slot untouched, preventing bricked devices in the field."
            },
            {
                "id": "q-iot-c-ota-exam-2",
                "prompt": "What security mechanism prevents an adversary from flashing older, vulnerable firmware versions onto an IoT device?",
                "options": [
                    {"id": "a", "text": "Anti-Rollback protection, which enforces that incoming version numbers must be greater than or equal to the current version."},
                    {"id": "b", "text": "Erasing the bootloader partition entirely."},
                    {"id": "c", "text": "Disabling the hardware timer."}
                ],
                "answerId": "a",
                "explanation": "Anti-rollback checks prevent downgrade attacks where an attacker deliberately re-flashes older factory firmware that contains known vulnerabilities."
            },
            {
                "id": "q-iot-c-ota-exam-3",
                "prompt": "What triggers an automated rollback to the previous firmware partition after an update?",
                "options": [
                    {"id": "a", "text": "The watchdog timer expiring or the application crashing before invoking `ota_mark_valid()`."},
                    {"id": "b", "text": "A standard PINGREQ message arriving from the MQTT broker."},
                    {"id": "c", "text": "The CPU temperature dropping below 20 degrees Celsius."}
                ],
                "answerId": "a",
                "explanation": "If the newly booted firmware crashes, hangs, or fails self-diagnostics before confirming success, the bootloader automatically reverts to the previous working slot."
            },
            {
                "id": "q-iot-c-ota-exam-4",
                "prompt": "Why is NOR Flash memory unsuitable for frequent, naive in-place parameter updates?",
                "options": [
                    {"id": "a", "text": "Flash requires erasing whole 4KB sectors before writing new values, rapidly exhausting physical sector write endurance (~100k cycles)."},
                    {"id": "b", "text": "Flash cannot be accessed by 32-bit CPU architectures."},
                    {"id": "c", "text": "Flash memory draws over 10 Amperes of current."}
                ],
                "answerId": "a",
                "explanation": "Erasing entire sectors repeatedly causes oxide breakdown and premature failure; log-structured NVS with wear-leveling is required."
            },
            {
                "id": "q-iot-c-ota-exam-5",
                "prompt": "What state does the bootloader assign to an newly updated firmware slot before its first boot cycle?",
                "options": [
                    {"id": "a", "text": "PENDING_VERIFY"},
                    {"id": "b", "text": "PERMANENT_VALID"},
                    {"id": "c", "text": "FACTORY_RESET"}
                ],
                "answerId": "a",
                "explanation": "PENDING_VERIFY flags the slot as trial firmware; if it fails to validate after reboot, the bootloader rolls back."
            }
        ]
    }
}

COURSE_10 = {
    "id": "iot-c-capstone",
    "version": 1,
    "order": 10,
    "title": "Production Edge IoT Firmware Suite Architecture",
    "summary": "Architect and build an industrial-grade edge IoT device firmware in C integrating sensor drivers, FreeRTOS tasks, circular ring buffers, MQTT telemetry, watchdog supervision, and remote diagnostics.",
    "difficulty": "Advanced",
    "minutes": 60,
    "codeExt": "c",
    "lessons": [
        {
            "id": "iot-c-cap-arch",
            "title": "Layered Architecture of Production Embedded IoT Systems",
            "paragraphs": [
                "Production firmware requires clean architectural layering to separate high-level business logic from bare-metal hardware registers. A standard embedded architecture comprises: Hardware Abstraction Layer (HAL) defining uniform register access, Board Support Package (BSP) configuring specific pinouts and board peripherals, RTOS Middleware (FreeRTOS, lwIP, mbedTLS), and Application Services (telemetry manager, state machine, command dispatcher).",
                "Decoupling via dependency injection and abstract interfaces in C (using function pointer structs) allows device firmware to be compiled and unit-tested on developer workstations (x86_64) using mock hardware buses in continuous integration (CI) pipelines, catching race conditions and edge cases before flashing target microcontrollers."
            ],
            "example": "// Abstract Sensor Driver Interface in C\ntypedef struct {\n    bool (*init)(void);\n    bool (*read_sample)(float *temp, float *hum);\n    void (*sleep)(void);\n} SensorDriver;\n\n// Hardware implementation\nextern const SensorDriver g_bme280_driver;\n// Mock implementation for host unit testing\nextern const SensorDriver g_mock_sensor_driver;",
            "pitfall": "Tightly coupling high-level application logic directly to hardware peripheral registers. If the microcontroller vendor changes, the entire firmware must be rewritten.",
            "question": {
                "id": "q-iot-c-cap-1",
                "prompt": "What is the primary benefit of decoupling hardware drivers from application logic via function pointer interfaces in C?",
                "options": [
                    {"id": "a", "text": "It allows unit testing application logic on developer workstations with mock drivers and porting across silicon vendors without rewriting core code."},
                    {"id": "b", "text": "It increases the UART transmission speed by 400%."},
                    {"id": "c", "text": "It automatically compresses machine code into Flash memory."}
                ],
                "answerId": "a",
                "explanation": "Layered abstraction allows desktop unit testing via mock drivers and protects the firmware investment when migrating across silicon vendors."
            }
        },
        {
            "id": "iot-c-cap-watchdog",
            "title": "Hardware Watchdog Timers (WDT) & Multi-Task Supervision",
            "paragraphs": [
                "In unmanned field deployments, microcontrollers must self-recover from deadlocks, infinite loops, and hardware lockups. A Hardware Watchdog Timer (WDT) runs on an independent silicon oscillator. If the firmware does not 'kick' (refresh) the watchdog register within a countdown window (e.g. 5000 ms), the WDT asserts a hardware reset line, rebooting the device.",
                "A dangerous anti-pattern is kicking the watchdog from a single high-priority timer ISR: if a worker task deadlocks on a mutex or an infinite loop, the timer ISR keeps running, kicking the watchdog and preventing recovery! A production Multi-Task Watchdog Supervisor requires every critical task (sensor polling, network communication, health monitor) to check in within its deadline before the supervisor kicks the hardware WDT."
            ],
            "example": "// Multi-task watchdog check-in system in C\n#define TASK_SENSOR_BIT  (1U << 0)\n#define TASK_NETWORK_BIT (1U << 1)\n#define ALL_TASKS_MASK   (TASK_SENSOR_BIT | TASK_NETWORK_BIT)\n\nstatic volatile uint32_t s_watchdog_checkin_bits = 0;\n\nvoid task_sensor_checkin(void)  { s_watchdog_checkin_bits |= TASK_SENSOR_BIT; }\nvoid task_network_checkin(void) { s_watchdog_checkin_bits |= TASK_NETWORK_BIT; }\n\nvoid watchdog_supervisor_step(void) {\n    if ((s_watchdog_checkin_bits & ALL_TASKS_MASK) == ALL_TASKS_MASK) {\n        hardware_wdt_refresh(); // All tasks healthy: refresh hardware watchdog\n        s_watchdog_checkin_bits = 0; // Clear check-in bits for next cycle\n    } else {\n        printf(\"[WDT] Stalled task detected! Letting hardware watchdog reset system...\\n\");\n    }\n}",
            "pitfall": "Refreshing the hardware watchdog timer inside a periodic timer interrupt. Even if the entire application deadlocks, the hardware timer ISR keeps kicking the watchdog, rendering it useless.",
            "question": {
                "id": "q-iot-c-cap-2",
                "prompt": "Why must multi-tasking IoT firmware use a multi-task watchdog supervisor instead of a simple timer ISR watchdog kick?",
                "options": [
                    {"id": "a", "text": "A timer ISR continues firing even when worker tasks are deadlocked, masking deadlocks; a supervisor verifies all tasks are actively running."},
                    {"id": "b", "text": "Hardware watchdogs cannot be cleared by software interrupts."},
                    {"id": "c", "text": "Timer ISRs double the electrical current draw of the crystal oscillator."}
                ],
                "answerId": "a",
                "explanation": "If a worker thread hangs, an isolated timer interrupt continues to kick the watchdog, defeating its purpose. The supervisor guarantees all tasks are healthy."
            }
        },
        {
            "id": "iot-c-cap-faults",
            "title": "HardFault Handlers, Stack Backtraces & Crash Dumps",
            "paragraphs": [
                "When a microcontroller encounters an unrecoverable hardware exception (such as dereferencing a NULL pointer, executing an invalid instruction, or performing an unaligned memory access), the CPU traps into a HardFault Exception. Default handlers spin in an infinite `while(1)` loop, requiring physical power-cycling and providing zero diagnostics.",
                "Production firmware uses a naked C/assembly HardFault Handler: it inspects whether the Main Stack Pointer (MSP) or Process Stack Pointer (PSP) was active, extracts the stacked CPU registers (R0-R3, R12, LR, PC, xPSR), logs the Program Counter (PC) where the crash occurred, writes a compact Crash Dump record to reserved RTC/NVS memory, and triggers an orderly system reset."
            ],
            "example": "// Conceptual ARM Cortex-M HardFault register dump structure\ntypedef struct {\n    uint32_t r0;\n    uint32_t r1;\n    uint32_t r2;\n    uint32_t r3;\n    uint32_t r12;\n    uint32_t lr;  // Link Register (return address)\n    uint32_t pc;  // Program Counter (crashing instruction)\n    uint32_t psr; // Program Status Register\n} HardFaultStackedRegisters;\n\nvoid hard_fault_c_handler(HardFaultStackedRegisters *regs) {\n    printf(\"[FAULT] HardFault Crash! Crashing PC = 0x%08X, LR = 0x%08X\\n\", regs->pc, regs->lr);\n    save_crash_dump_to_nvs(regs);\n    system_reset();\n}",
            "pitfall": "Leaving default `while(1);` infinite loops inside HardFault handlers. Devices in the field freeze silently with no diagnostic record and no automatic recovery.",
            "question": {
                "id": "q-iot-c-cap-3",
                "prompt": "What critical diagnostic register captured in a HardFault handler reveals the exact memory address of the instruction that caused the crash?",
                "options": [
                    {"id": "a", "text": "The Program Counter (PC)"},
                    {"id": "b", "text": "The ADC conversion register"},
                    {"id": "c", "text": "The UART baud rate prescaler"}
                ],
                "answerId": "a",
                "explanation": "The Program Counter (PC) points to the instruction that was executing when the fault occurred, allowing developers to locate the exact source line using `addr2line` or GDB."
            }
        },
        {
            "id": "iot-c-cap-telemetry",
            "title": "Edge Telemetry Pipelines, Health Diagnostics & Maintenance",
            "paragraphs": [
                "An industrial edge IoT node operates as an integrated telemetry pipeline: sensors sample physical phenomena -> values are filtered through rolling averages -> records enter lock-free ring buffers -> a background task serializes records into compact binary payloads with HMAC signatures -> data is published to MQTT or queued in flash if offline.",
                "In addition to sensor data, production firmware continuously reports Device Health Metrics: heap high watermarks, minimum task stack headroom, Wi-Fi Received Signal Strength Indicator (RSSI), dropped packet counters, and boot reason codes. When field anomalies occur, cloud dashboards alert operators before device failures occur."
            ],
            "example": "// Diagnostic device telemetry structure in C\ntypedef struct {\n    uint32_t uptime_seconds;\n    int8_t   wifi_rssi_dbm;\n    uint16_t free_heap_bytes;\n    uint16_t min_stack_headroom_words;\n    uint32_t packets_sent;\n    uint32_t packets_dropped;\n    uint8_t  last_reset_reason;\n} DeviceHealthMetrics;",
            "pitfall": "Transmitting raw, unbuffered telemetry without local queuing. When network connectivity drops momentarily, readings are permanently lost unless buffered in a FIFO ring queue.",
            "question": {
                "id": "q-iot-c-cap-4",
                "prompt": "Why should edge IoT devices report diagnostic health metrics (stack headroom, RSSI, dropped packets) alongside sensor readings?",
                "options": [
                    {"id": "a", "text": "To enable remote proactive monitoring, identifying degrading network signal or approaching stack overflows before devices fail in the field."},
                    {"id": "b", "text": "Health metrics increase the solar panel charging current."},
                    {"id": "c", "text": "To satisfy browser cookie consent regulations."}
                ],
                "answerId": "a",
                "explanation": "Monitoring operational telemetry (stack headroom, dropped packets, heap status) allows operators to catch firmware regressions and environmental degradation before outages occur."
            }
        }
    ],
    "steps": [
        "Review the production layered firmware architecture diagram and sensor HAL interface.",
        "Examine the cooperative multi-task watchdog supervisor and crash dump logger.",
        "Inspect the end-to-end telemetry pipeline from sensor sampling to HMAC-signed packet dispatch.",
        "Compile and execute `iot-c-capstone.c` with GCC: `gcc -std=c11 -Wall -Wextra iot-c-capstone.c -o iot-c-capstone`."
    ],
    "expected": "The complete production firmware suite initializes hardware drivers, starts scheduled worker tasks, acquires sensor readings into a circular FIFO queue, exercises multi-task watchdog supervision, and formats verified diagnostic telemetry.",
    "code": """#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

#define RING_BUFFER_CAPACITY 8
#define TASK_SENSOR_BIT      (1U << 0)
#define TASK_TELEMETRY_BIT   (1U << 1)
#define ALL_TASKS_CHECKIN    (TASK_SENSOR_BIT | TASK_TELEMETRY_BIT)

typedef struct {
    uint32_t timestamp_ms;
    float temperature;
    float humidity;
} SensorReading;

typedef struct {
    SensorReading buffer[RING_BUFFER_CAPACITY];
    uint32_t head;
    uint32_t tail;
    uint32_t count;
    uint32_t dropped;
} TelemetryRingBuffer;

typedef struct {
    uint32_t uptime_s;
    uint32_t packets_sent;
    uint32_t packets_dropped;
    uint32_t min_stack_words;
    uint8_t  watchdog_resets;
} DeviceHealth;

static TelemetryRingBuffer s_telemetry_queue;
static DeviceHealth s_health = { .uptime_s = 0, .packets_sent = 0, .packets_dropped = 0,
                                 .min_stack_words = 240, .watchdog_resets = 0 };
static volatile uint32_t s_watchdog_bits = 0;

void queue_init(TelemetryRingBuffer *q) {
    memset(q, 0, sizeof(*q));
}

bool queue_push(TelemetryRingBuffer *q, SensorReading reading) {
    if (q->count >= RING_BUFFER_CAPACITY) {
        q->dropped++;
        s_health.packets_dropped++;
        return false;
    }
    q->buffer[q->head] = reading;
    q->head = (q->head + 1) % RING_BUFFER_CAPACITY;
    q->count++;
    return true;
}

bool queue_pop(TelemetryRingBuffer *q, SensorReading *reading) {
    if (q->count == 0) return false;
    *reading = q->buffer[q->tail];
    q->tail = (q->tail + 1) % RING_BUFFER_CAPACITY;
    q->count--;
    return true;
}

void task_sensor_sample(uint32_t now_ms) {
    SensorReading reading = {
        .timestamp_ms = now_ms,
        .temperature = 24.5f + (float)((now_ms / 100) % 5) * 0.2f,
        .humidity = 55.0f
    };
    queue_push(&s_telemetry_queue, reading);
    s_watchdog_bits |= TASK_SENSOR_BIT; // Task check-in
}

void task_telemetry_transmit(void) {
    SensorReading item;
    while (queue_pop(&s_telemetry_queue, &item)) {
        s_health.packets_sent++;
    }
    s_watchdog_bits |= TASK_TELEMETRY_BIT; // Task check-in
}

bool watchdog_supervisor_evaluate(void) {
    if ((s_watchdog_bits & ALL_TASKS_CHECKIN) == ALL_TASKS_CHECKIN) {
        s_watchdog_bits = 0; // Reset for next supervisory cycle
        return true;         // Healthy: kick hardware watchdog
    }
    return false; // Deadlock or stalled task detected
}

int main(void) {
    printf(\"[CAPSTONE] Initializing Production Edge IoT Firmware Suite in C...\\n\");
    queue_init(&s_telemetry_queue);

    printf(\"[INIT] Hardware Abstraction Layer & Ring Buffer ready (Capacity=%d)\\n\", RING_BUFFER_CAPACITY);
    printf(\"[INIT] Multi-Task Watchdog Supervisor armed with ALL_TASKS_CHECKIN=0x%02X\\n\", ALL_TASKS_CHECKIN);

    // Simulate 500 execution cycles
    for (uint32_t cycle = 1; cycle <= 500; cycle++) {
        uint32_t now_ms = cycle * 10;
        if ((cycle % 10) == 0) s_health.uptime_s++;

        // Execute sensor sampling and telemetry worker tasks
        task_sensor_sample(now_ms);
        task_telemetry_transmit();

        // Supervisor evaluates task health every 50 cycles
        if ((cycle % 50) == 0) {
            bool healthy = watchdog_supervisor_evaluate();
            if (!healthy) {
                printf(\"[ERROR] Watchdog supervisor detected stalled task at cycle %u!\\n\", cycle);
                return 1;
            }
        }
    }

    printf(\"\\n--- PRODUCTION FIRMWARE DIAGNOSTIC REPORT ---\\n\");
    printf(\"  Uptime: %u seconds\\n\", s_health.uptime_s);
    printf(\"  Packets Sent: %u\\n\", s_health.packets_sent);
    printf(\"  Packets Dropped: %u\\n\", s_health.packets_dropped);
    printf(\"  Stack Headroom: %u words\\n\", s_health.min_stack_words);
    printf(\"  Watchdog Resets: %u\\n\", s_health.watchdog_resets);

    if (s_health.packets_sent != 500 || s_health.packets_dropped != 0) {
        printf(\"[ERROR] Telemetry pipeline dropped unexpected packets!\\n\");
        return 1;
    }

    printf(\"[STATUS] Complete Production IoT Edge Firmware Suite verified cleanly.\\n\");
    return 0;
}
""",
    "challenge": {
        "task": "Add an edge alarm threshold alert to the capstone firmware that triggers high-priority packets when metrics exceed bounds.",
        "acceptance": [
            "Implement an alert detection function triggering when temperature exceeds 28.0C.",
            "Queue alarm packets with highest priority ahead of normal telemetry records.",
            "Verify all diagnostic health counters accurately reflect dropped packets under stress."
        ]
    },
    "sources": [
        {"title": "Making Embedded Systems: Design Patterns for Great Software (Elecia White)", "url": "https://www.oreilly.com/library/view/making-embedded-systems/9781449302146/"},
        {"title": "Embedded C Coding Standard (Michael Barr / Barr Group)", "url": "https://barrgroup.com/embedded-systems/books/embedded-c-coding-standard"}
    ],
    "exam": {
        "passPercent": 80,
        "questions": [
            {
                "id": "q-iot-c-cap-exam-1",
                "prompt": "What critical failure mode occurs if a watchdog timer is refreshed exclusively inside an isolated timer ISR?",
                "options": [
                    {"id": "a", "text": "The timer ISR keeps kicking the watchdog even if main worker tasks are permanently deadlocked, masking failures."},
                    {"id": "b", "text": "The watchdog frequency permanently increases by 1000%."},
                    {"id": "c", "text": "The microcontroller shuts down its power regulator."}
                ],
                "answerId": "a",
                "explanation": "If the timer interrupt runs independently, it refreshes the watchdog regardless of application health, allowing hung worker tasks to remain deadlocked indefinitely."
            },
            {
                "id": "q-iot-c-cap-exam-2",
                "prompt": "What does a Multi-Task Watchdog Supervisor require before refreshing the hardware watchdog?",
                "options": [
                    {"id": "a", "text": "Every critical worker task must register a check-in bit within its specified time window."},
                    {"id": "b", "text": "All network packets must be acknowledged by the cloud broker."},
                    {"id": "c", "text": "The Flash partition table must be re-verified."}
                ],
                "answerId": "a",
                "explanation": "A multi-task supervisor checks that each designated task checked in; if any task stalls or starves, check-in fails and the watchdog resets the system."
            },
            {
                "id": "q-iot-c-cap-exam-3",
                "prompt": "What information does a HardFault handler capture to assist engineers with post-mortem debugging?",
                "options": [
                    {"id": "a", "text": "Stacked CPU core registers (R0-R3, R12, LR, PC, xPSR) indicating the crashing instruction address."},
                    {"id": "b", "text": "The user's Wi-Fi SSID and password."},
                    {"id": "c", "text": "The geographic GPS coordinates of the factory."}
                ],
                "answerId": "a",
                "explanation": "Stacked registers contain the Link Register (return address) and Program Counter (faulting instruction), pinpointing the exact line of code that triggered the fault."
            },
            {
                "id": "q-iot-c-cap-exam-4",
                "prompt": "Why should high-reliability edge nodes buffer sensor telemetry in a local FIFO ring queue before network dispatch?",
                "options": [
                    {"id": "a", "text": "To prevent telemetry loss during transient network disconnects or broker latency spikes."},
                    {"id": "b", "text": "To encrypt sensor readings using analog frequencies."},
                    {"id": "c", "text": "To double the sampling resolution of the ADC."}
                ],
                "answerId": "a",
                "explanation": "Wireless connectivity drops frequently. Queuing readings in a FIFO buffer allows the device to ride out transient outages without losing sensor data."
            },
            {
                "id": "q-iot-c-cap-exam-5",
                "prompt": "What is the primary architectural purpose of a Hardware Abstraction Layer (HAL) in an industrial IoT codebase?",
                "options": [
                    {"id": "a", "text": "To isolate high-level application business logic from specific silicon register addresses, enabling automated host unit testing and portability."},
                    {"id": "b", "text": "To translate C code into JavaScript for web browsers."},
                    {"id": "c", "text": "To increase the physical Flash memory capacity of the chip."}
                ],
                "answerId": "a",
                "explanation": "HAL isolates hardware dependencies behind clean interfaces, allowing code to be tested on desktop platforms with mock peripherals and ported between chips."
            }
        ]
    }
}

COURSES_7_TO_10 = [COURSE_7, COURSE_8, COURSE_9, COURSE_10]
