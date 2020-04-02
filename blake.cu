//
//  =============== BLAKE part on nVidia GPU ======================
//
// This is the generic "default" implementation when no architecture
// specific implementation is available in the kernel.
//
// NOTE: compile this .cu module for compute_10,sm_10 with --maxrregcount=64
//
// TODO: CUDA porting work remains to be done.
//

#include <map>
#include <stdint.h>

#include "salsa_kernel.h"
#include "miner.h"

typedef uint32_t sph_u32;
#define SPH_C32(x) ((sph_u32)(x))
#define SPH_T32(x) ((x) & SPH_C32(0xFFFFFFFF))
#define SPH_ROTL32(x, n)   SPH_T32(((x) << (n)) | ((x) >> (32 - (n))))
#define SPH_ROTR32(x, n)   SPH_ROTL32(x, (32 - (n)))

__constant__ uint64_t ptarget64[4];
__constant__ uint32_t pdata[20];

// define some error checking macros
#undef checkCudaErrors

#if WIN32
#define DELIMITER '/'
#else
#define DELIMITER '/'
#endif
#define __FILENAME__ ( strrchr(__FILE__, DELIMITER) != NULL ? strrchr(__FILE__, DELIMITER)+1 : __FILE__ )

#define checkCudaErrors(x) \
{ \
    cudaGetLastError(); \
    x; \
    cudaError_t err = cudaGetLastError(); \
    if (err != cudaSuccess) \
        applog(LOG_ERR, "GPU #%d: cudaError %d (%s) calling '%s' (%s line %d)\n", device_map[thr_id], err, cudaGetErrorString(err), #x, __FILENAME__, __LINE__); \
}

// from salsa_kernel.cu
extern std::map<int, uint32_t *> context_idata[2];
extern std::map<int, uint32_t *> context_odata[2];
extern std::map<int, cudaStream_t> context_streams[2];
extern std::map<int, uint32_t *> context_hash[2];

#ifdef _MSC_VER
#pragma warning (disable: 4146)
#endif

static __device__ sph_u32 cuda_sph_bswap32(sph_u32 x)
{
    return (((x << 24) & 0xff000000u) | ((x << 8) & 0x00ff0000u)
          | ((x >> 8) & 0x0000ff00u) | ((x >> 24) & 0x000000ffu));
}

/**
 * Encode a 32-bit value into the provided buffer (big endian convention).
 *
 * @param dst   the destination buffer
 * @param val   the 32-bit value to encode
 */
static __device__ void
cuda_sph_enc32be(void *dst, sph_u32 val)
{
    *(sph_u32 *)dst = cuda_sph_bswap32(val);
}

#define Z00   0
#define Z01   1
#define Z02   2
#define Z03   3
#define Z04   4
#define Z05   5
#define Z06   6
#define Z07   7
#define Z08   8
#define Z09   9
#define Z0A   A
#define Z0B   B
#define Z0C   C
#define Z0D   D
#define Z0E   E
#define Z0F   F

#define Z10   E
#define Z11   A
#define Z12   4
#define Z13   8
#define Z14   9
#define Z15   F
#define Z16   D
#define Z17   6
#define Z18   1
#define Z19   C
#define Z1A   0
#define Z1B   2
#define Z1C   B
#define Z1D   7
#define Z1E   5
#define Z1F   3

#define Z20   B
#define Z21   8
#define Z22   C
#define Z23   0
#define Z24   5
#define Z25   2
#define Z26   F
#define Z27   D
#define Z28   A
#define Z29   E
#define Z2A   3
#define Z2B   6
#define Z2C   7
#define Z2D   1
#define Z2E   9
#define Z2F   4

#define Z30   7
#define Z31   9
#define Z32   3
#define Z33   1
#define Z34   D
#define Z35   C
#define Z36   B
#define Z37   E
#define Z38   2
#define Z39   6
#define Z3A   5
#define Z3B   A
#define Z3C   4
#define Z3D   0
#define Z3E   F
#define Z3F   8

#define Z40   9
#define Z41   0
#define Z42   5
#define Z43   7
#define Z44   2
#define Z45   4
#define Z46   A
#define Z47   F
#define Z48   E
#define Z49   1
#define Z4A   B
#define Z4B   C
#define Z4C   6
#define Z4D   8
#define Z4E   3
#define Z4F   D

#define Z50   2
#define Z51   C
#define Z52   6
#define Z53   A
#define Z54   0
#define Z55   B
#define Z56   8
#define Z57   3
#define Z58   4
#define Z59   D
#define Z5A   7
#define Z5B   5
#define Z5C   F
#define Z5D   E
#define Z5E   1
#define Z5F   9

#define Z60   C
#define Z61   5
#define Z62   1
#define Z63   F
#define Z64   E
#define Z65   D
#define Z66   4
#define Z67   A
#define Z68   0
#define Z69   7
#define Z6A   6
#define Z6B   3
#define Z6C   9
#define Z6D   2
#define Z6E   8
#define Z6F   B

#define Z70   D
#define Z71   B
#define Z72   7
#define Z73   E
#define Z74   C
#define Z75   1
#define Z76   3
#define Z77   9
#define Z78   5
#define Z79   0
#define Z7A   F
#define Z7B   4
#define Z7C   8
#define Z7D   6
#define Z7E   2
#define Z7F   A

#define Z80   6
#define Z81   F
#define Z82   E
#define Z83   9
#define Z84   B
#define Z85   3
#define Z86   0
#define Z87   8
#define Z88   C
#define Z89   2
#define Z8A   D
#define Z8B   7
#define Z8C   1
#define Z8D   4
#define Z8E   A
#define Z8F   5

#define Z90   A
#define Z91   2
#define Z92   8
#define Z93   4
#define Z94   7
#define Z95   6
#define Z96   1
#define Z97   5
#define Z98   F
#define Z99   B
#define Z9A   9
#define Z9B   E
#define Z9C   3
#define Z9D   C
#define Z9E   D
#define Z9F   0

#define Mx(r, i)    Mx_(Z ## r ## i)
#define Mx_(n)      Mx__(n)
#define Mx__(n)     M ## n

#define CSx(r, i)   CSx_(Z ## r ## i)
#define CSx_(n)     CSx__(n)
#define CSx__(n)    CS ## n

#define CS0   SPH_C32(0x243F6A88)
#define CS1   SPH_C32(0x85A308D3)
#define CS2   SPH_C32(0x13198A2E)
#define CS3   SPH_C32(0x03707344)
#define CS4   SPH_C32(0xA4093822)
#define CS5   SPH_C32(0x299F31D0)
#define CS6   SPH_C32(0x082EFA98)
#define CS7   SPH_C32(0xEC4E6C89)
#define CS8   SPH_C32(0x452821E6)
#define CS9   SPH_C32(0x38D01377)
#define CSA   SPH_C32(0xBE5466CF)
#define CSB   SPH_C32(0x34E90C6C)
#define CSC   SPH_C32(0xC0AC29B7)
#define CSD   SPH_C32(0xC97C50DD)
#define CSE   SPH_C32(0x3F84D5B5)
#define CSF   SPH_C32(0xB5470917)

#define GS(m0, m1, c0, c1, a, b, c, d)   do { \
        a = SPH_T32(a + b + (m0 ^ c1)); \
        d = SPH_ROTR32(d ^ a, 16); \
        c = SPH_T32(c + d); \
        b = SPH_ROTR32(b ^ c, 12); \
        a = SPH_T32(a + b + (m1 ^ c0)); \
        d = SPH_ROTR32(d ^ a, 8); \
        c = SPH_T32(c + d); \
        b = SPH_ROTR32(b ^ c, 7); \
    } while (0)

#define ROUND_S(r)   do { \
        GS(Mx(r, 0), Mx(r, 1), CSx(r, 0), CSx(r, 1), V0, V4, V8, VC); \
        GS(Mx(r, 2), Mx(r, 3), CSx(r, 2), CSx(r, 3), V1, V5, V9, VD); \
        GS(Mx(r, 4), Mx(r, 5), CSx(r, 4), CSx(r, 5), V2, V6, VA, VE); \
        GS(Mx(r, 6), Mx(r, 7), CSx(r, 6), CSx(r, 7), V3, V7, VB, VF); \
        GS(Mx(r, 8), Mx(r, 9), CSx(r, 8), CSx(r, 9), V0, V5, VA, VF); \
        GS(Mx(r, A), Mx(r, B), CSx(r, A), CSx(r, B), V1, V6, VB, VC); \
        GS(Mx(r, C), Mx(r, D), CSx(r, C), CSx(r, D), V2, V7, V8, VD); \
        GS(Mx(r, E), Mx(r, F), CSx(r, E), CSx(r, F), V3, V4, V9, VE); \
    } while (0)

#define COMPRESS32   do { \
        sph_u32 M0, M1, M2, M3, M4, M5, M6, M7; \
        sph_u32 M8, M9, MA, MB, MC, MD, ME, MF; \
        sph_u32 V0, V1, V2, V3, V4, V5, V6, V7; \
        sph_u32 V8, V9, VA, VB, VC, VD, VE, VF; \
        V0 = H0; \
        V1 = H1; \
        V2 = H2; \
        V3 = H3; \
        V4 = H4; \
        V5 = H5; \
        V6 = H6; \
        V7 = H7; \
        V8 = S0 ^ CS0; \
        V9 = S1 ^ CS1; \
        VA = S2 ^ CS2; \
        VB = S3 ^ CS3; \
        VC = T0 ^ CS4; \
        VD = T0 ^ CS5; \
        VE = T1 ^ CS6; \
        VF = T1 ^ CS7; \
        M0 = input[0]; \
        M1 = input[1]; \
        M2 = input[2]; \
        M3 = input[3]; \
        M4 = input[4]; \
        M5 = input[5]; \
        M6 = input[6]; \
        M7 = input[7]; \
        M8 = input[8]; \
        M9 = input[9]; \
        MA = input[10]; \
        MB = input[11]; \
        MC = input[12]; \
        MD = input[13]; \
        ME = input[14]; \
        MF = input[15]; \
        ROUND_S(0); \
        ROUND_S(1); \
        ROUND_S(2); \
        ROUND_S(3); \
        ROUND_S(4); \
        ROUND_S(5); \
        ROUND_S(6); \
        ROUND_S(7); \
        H0 ^= S0 ^ V0 ^ V8; \
        H1 ^= S1 ^ V1 ^ V9; \
        H2 ^= S2 ^ V2 ^ VA; \
        H3 ^= S3 ^ V3 ^ VB; \
        H4 ^= S0 ^ V4 ^ VC; \
        H5 ^= S1 ^ V5 ^ VD; \
        H6 ^= S2 ^ V6 ^ VE; \
        H7 ^= S3 ^ V7 ^ VF; \
    } while (0)

__global__ void cuda_blake256_hash( uint64_t *g_out, uint32_t nonce, uint32_t *g_good, bool validate )
{
    uint32_t input[16];
    uint64_t output[4];

#pragma unroll 16
    for (int i=0; i < 16; ++i) input[i] = pdata[i];

    sph_u32 H0 = 0x6A09E667;
    sph_u32 H1 = 0xBB67AE85;
    sph_u32 H2 = 0x3C6EF372;
    sph_u32 H3 = 0xA54FF53A;
    sph_u32 H4 = 0x510E527F;
    sph_u32 H5 = 0x9B05688C;
    sph_u32 H6 = 0x1F83D9AB;
    sph_u32 H7 = 0x5BE0CD19;
    sph_u32 S0 = 0;
    sph_u32 S1 = 0;
    sph_u32 S2 = 0;
    sph_u32 S3 = 0;
    sph_u32 T0 = 0;
    sph_u32 T1 = 0;
    T0 = SPH_T32(T0 + 512);
    COMPRESS32;

#pragma unroll 3
    for (int i=0; i < 3; ++i) input[i] = pdata[16+i];
    input[3] = nonce + ((blockIdx.x * blockDim.x) + threadIdx.x);
    input[4] = 0x80000000;
#pragma unroll 8
    for (int i=5; i < 13; ++i) input[i] = 0;
    input[13] = 0x00000001;
    input[14] = T1;
    input[15] = T0 + 128;

    T0 = SPH_T32(T0 + 128);
    COMPRESS32;

    cuda_sph_enc32be((unsigned char*)output + 4*6, H6);
    cuda_sph_enc32be((unsigned char*)output + 4*7, H7);
    if (validate || output[3] <=  ptarget64[3])
    {
        // this data is only needed when we actually need to save the hashes
        cuda_sph_enc32be((unsigned char*)output + 4*0, H0);
        cuda_sph_enc32be((unsigned char*)output + 4*1, H1);
        cuda_sph_enc32be((unsigned char*)output + 4*2, H2);
        cuda_sph_enc32be((unsigned char*)output + 4*3, H3);
        cuda_sph_enc32be((unsigned char*)output + 4*4, H4);
        cuda_sph_enc32be((unsigned char*)output + 4*5, H5);
    }

    if (validate)
    {
        g_out += 4 * ((blockIdx.x * blockDim.x) + threadIdx.x);
#pragma unroll 4
        for (int i=0; i < 4; ++i) g_out[i] = output[i];
    }

    if (output[3] <=  ptarget64[3]) {
        uint64_t *g_good64 = (uint64_t*)g_good;
        if (output[3] < g_good64[3]) {
            g_good64[3] = output[3];
            g_good64[2] = output[2];
            g_good64[1] = output[1];
            g_good64[0] = output[0];
            g_good[8] = nonce + ((blockIdx.x * blockDim.x) + threadIdx.x);
        }
    }
}

static std::map<int, uint32_t *> context_good[2];

extern "C" void default_prepare_blake256(int thr_id, const uint32_t host_pdata[20], const uint32_t host_ptarget[8])
{
    static bool init[8] = {false, false, false, false, false, false, false, false};
    if (!init[thr_id])
    {
        // allocate pinned host memory for good hashes
        uint32_t *tmp;
        checkCudaErrors(cudaMalloc((void **) &tmp, 9*sizeof(uint32_t))); context_good[0][thr_id] = tmp;
        checkCudaErrors(cudaMalloc((void **) &tmp, 9*sizeof(uint32_t))); context_good[1][thr_id] = tmp;

        init[thr_id] = true;
    }
    checkCudaErrors(cudaMemcpyToSymbol(pdata, host_pdata, 20*sizeof(uint32_t), 0, cudaMemcpyHostToDevice));
    checkCudaErrors(cudaMemcpyToSymbol(ptarget64, host_ptarget, 8*sizeof(uint32_t), 0, cudaMemcpyHostToDevice));
}

extern "C" bool default_do_blake256(dim3 grid, dim3 threads, int thr_id, int stream, uint32_t *hash, uint32_t nonce, int throughput, bool do_d2h)
{
    bool success = true;
  
    checkCudaErrors(cudaMemsetAsync(context_good[stream][thr_id], 0xff, 9 * sizeof(uint32_t), context_streams[stream][thr_id]));

    cuda_blake256_hash<<<grid, threads, 0, context_streams[stream][thr_id]>>>((uint64_t*)context_hash[stream][thr_id], nonce, context_good[stream][thr_id], do_d2h);

    // copy hashes from device memory to host (ALL hashes, lots of data...)
    if (do_d2h && hash != NULL) {
        size_t mem_size = throughput * sizeof(uint32_t) * 8;
        checkCudaErrors(cudaMemcpyAsync(hash, context_hash[stream][thr_id], mem_size,
                        cudaMemcpyDeviceToHost, context_streams[stream][thr_id]));
    }
    else if (hash != NULL) {
        // asynchronous copy of winning nonce (just 4 bytes...)
        checkCudaErrors(cudaMemcpyAsync(hash, context_good[stream][thr_id]+8, sizeof(uint32_t),
                        cudaMemcpyDeviceToHost, context_streams[stream][thr_id]));
    }

        // catch any kernel launch failures
    if (cudaPeekAtLastError() != cudaSuccess) success = false;

    return success;
}
