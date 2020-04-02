#include "cpuminer-config.h"
#include "miner.h"
#include "salsa_kernel.h"

#include <string.h>
#include <stdint.h>

#include "sph_blake.h"

static void blake256_hash(void *state, const void *input, size_t inlen )
{
    sph_blake256_context ctx;
    sph_blake256_init(&ctx);
    sph_blake256 (&ctx, input, 80);
    sph_blake256_close (&ctx, state);
}

int scanhash_blake(int thr_id, uint32_t *pdata, const uint32_t *ptarget,
	uint32_t max_nonce, struct timeval *tv_start, struct timeval *tv_end, unsigned long *hashes_done)
{
	int throughput = cuda_throughput(thr_id);

	gettimeofday(tv_start, NULL);

	uint32_t n = pdata[19] - 1;
	
	// TESTING ONLY
//	((uint32_t*)ptarget)[7] = 0x0000000f;
	
	const uint32_t Htarg = ptarget[7];

	uint32_t endiandata[20];
	for (int kk=0; kk < 20; kk++)
		be32enc(&endiandata[kk], pdata[kk]);

	// passing the original pdata array to CUDA here, not endiandata
	cuda_prepare_blake256(thr_id, pdata, ptarget);

	uint32_t *cuda_hash64[2] = { (uint32_t *)cuda_hashbuffer(thr_id, 0), (uint32_t *)cuda_hashbuffer(thr_id, 1) };
	memset(cuda_hash64[0], 0xff, throughput * 8 * sizeof(uint32_t));
	memset(cuda_hash64[1], 0xff, throughput * 8 * sizeof(uint32_t));

	bool validate = false;
	uint32_t nonce[2];
	int cur = 0, nxt = 1;

	// begin work on first CUDA stream
	nonce[cur] = n+1; n += throughput;
	cuda_do_blake256(thr_id, 0, cuda_hash64[cur], nonce[cur], throughput, validate);

	do {

		nonce[nxt] = n+1; n += throughput;
		if ((n-throughput) < max_nonce && !work_restart[thr_id].restart)
		{
			// begin work on next CUDA stream
			cuda_do_blake256(thr_id, 0, cuda_hash64[nxt], nonce[nxt], throughput, validate);
		}

		// synchronize current stream and get the "winning" nonce index, if any
		cuda_scrypt_sync(thr_id, cur);
		uint32_t result =  *cuda_hash64[cur];

		// optional full CPU based validation (see validate flag)
		if (validate)
		{
			for (int i=0; i < throughput; ++i)
			{
				uint32_t hash64[8];
				be32enc(&endiandata[19], nonce[cur]+i); 
				blake256_hash( hash64, &endiandata[0], 80 );
	
				if (memcmp(hash64, &cuda_hash64[cur][8*i], 32))
					fprintf(stderr, "CPU and CUDA hashes (i=%d) differ!\n", i);
			}
		}
		else if (result != 0xffffffff && result > pdata[19])
		{
			uint32_t hash64[8];
			be32enc(&endiandata[19], result);
			blake256_hash( hash64, &endiandata[0], 80 );
			if (result >= nonce[cur] && result < nonce[cur]+throughput && hash64[7] <= Htarg && fulltest(hash64, ptarget)) {
				*hashes_done = n-throughput - pdata[19] + 1;
				pdata[19] = result;
				gettimeofday(tv_end, NULL);
				return true;
			} else {
				applog(LOG_INFO, "GPU #%d: %s result for nonce $%08x does not validate on CPU!", device_map[thr_id], device_name[thr_id], result);
			}
		}
		cur = (cur + 1) % 2;
		nxt = (nxt + 1) % 2;
	} while ((n-throughput) < max_nonce && !work_restart[thr_id].restart);
	
	*hashes_done = n-throughput - pdata[19] + 1;
	if (n-throughput > pdata[19])
		// CB: don't report values bigger max_nonce
		pdata[19] = max_nonce > n-throughput ? n-throughput : max_nonce;
	else
		pdata[19] = 0xffffffffU; // CB: prevent nonce space overflow.
	gettimeofday(tv_end, NULL);
	return 0;
}
