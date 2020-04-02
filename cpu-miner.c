/*
 * Copyright 2010 Jeff Garzik
 * Copyright 2012-2013 pooler
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.  See COPYING for more details.
 */

#include "cpuminer-config.h"
#define _GNU_SOURCE

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <stdint.h>
#include <unistd.h>
#include <sys/time.h>
#include <time.h>
#ifdef WIN32
#include <windows.h>
#else
#include <errno.h>
#include <signal.h>
#include <sys/resource.h>
#if HAVE_SYS_SYSCTL_H
#include <sys/types.h>
#if HAVE_SYS_PARAM_H
#include <sys/param.h>
#endif
#include <sys/sysctl.h>
#endif
#endif
#include <jansson.h>
#include <curl/curl.h>
#include <openssl/sha.h>
#include "compat.h"
#include "miner.h"
#include "salsa_kernel.h"

<<<<<<< HEAD
#ifdef WIN32
#include <Mmsystem.h>
#pragma comment(lib, "winmm.lib")
#endif

#if 1 || defined(USE_WRAPNVML)
#define USE_WRAPNVML 1
#include "wrapnvml.h"
#endif

=======
>>>>>>> parent of c8188a9... call timeBeginPeriod() in cudaminer on WIN32 to boost thread scheduling resolution (mimicks Google Chrome trick?)
bool abort_flag = false; // CB
bool autotune = true;
int device_map[8] = { 0, 1, 2, 3, 4, 5, 6, 7 };
int device_interactive[8] = { -1, -1, -1, -1, -1, -1, -1, -1 };
int device_batchsize[8] = { 1024, 1024, 1024, 1024, 1024, 1024, 1024, 1024 };
#if WIN32
int device_backoff[8] = { 12, 12, 12, 12, 12, 12, 12, 12 };
#else
int device_backoff[8] = { 2, 2, 2, 2, 2, 2, 2, 2 };
#endif
int device_lookup_gap[8] = { 1, 1, 1, 1, 1, 1, 1, 1 };
int device_texturecache[8] = { -1, -1, -1, -1, -1, -1, -1, -1 };
int device_singlememory[8] = { -1, -1, -1, -1, -1, -1, -1, -1 };
char *device_config[8] = {NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL};
char *device_name[8] = {NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL};

#if defined(USE_WRAPNVML)
wrap_nvml_handle *nvmlh = NULL;
#endif

#define PROGRAM_NAME		"cudaminer"
#define PROGRAM_VERSION		"2014-02-28"
#define DEF_RPC_URL		"http://127.0.0.1:9332/"
#define LP_SCANTIME		60

#ifdef __linux /* Linux specific policy and affinity management */
#include <sched.h>
static inline void drop_policy(void)
{
	struct sched_param param;

#ifdef SCHED_IDLE
	if (unlikely(sched_setscheduler(0, SCHED_IDLE, &param) == -1))
#endif
#ifdef SCHED_BATCH
		sched_setscheduler(0, SCHED_BATCH, &param);
#endif
}

static inline void affine_to_cpu(int id, int cpu)
{
	cpu_set_t set;

	CPU_ZERO(&set);
	CPU_SET(cpu, &set);
	sched_setaffinity(0, sizeof(&set), &set);
}
#elif defined(__FreeBSD__) /* FreeBSD specific policy and affinity management */
#include <sys/cpuset.h>
static inline void drop_policy(void)
{
}

static inline void affine_to_cpu(int id, int cpu)
{
// CB
//    applog(LOG_INFO, "Binding Linux thread %d to cpu %d", id, cpu);
	cpuset_t set;
	CPU_ZERO(&set);
	CPU_SET(cpu, &set);
	cpuset_setaffinity(CPU_LEVEL_WHICH, CPU_WHICH_CPUSET, -1, sizeof(cpuset_t), &set);
}
#else
static inline void drop_policy(void)
{
}

static inline void affine_to_cpu(int id, int cpu)
{
#if WIN32  // CB
//    applog(LOG_INFO, "Binding Windows thread %d to cpu %d", id, cpu);
    DWORD mask = 1 << cpu;
    SetThreadAffinityMask(GetCurrentThread(), mask);
#endif
}
#endif
		
enum workio_commands {
	WC_GET_WORK,
	WC_SUBMIT_WORK,
	WC_ABORT,  // CB
};

struct workio_cmd {
	enum workio_commands	cmd;
	struct thr_info		*thr;
	union {
		struct work	*work;
	} u;
};

static const char *algo_names[] = {
	"scrypt",
	"scrypt-jane",
	"sha256d",
	"keccak",
	"blake",
};

bool opt_debug = false;
bool opt_protocol = false;
bool opt_benchmark = false;
bool want_longpoll = true;
bool have_longpoll = false;
bool want_stratum = true;
bool have_stratum = false;
static bool submit_old = false;
bool use_syslog = false;
static bool opt_background = false;
static bool opt_quiet = false;
static int opt_retries = -1;
static int opt_fail_pause = 15; // CB
static int opt_time_limit = 0; // CB
int opt_timeout = 270;
int opt_scantime = 5;
static json_t *opt_config;
static const bool opt_time = true;
enum sha256_algos opt_algo = ALGO_SCRYPT; // CB
char *jane_params = ""; // CB
static int opt_n_threads;
int num_processors; // CB
static int num_gpus; // CB
int parallel = 2; // CB
unsigned int N = 1024; // CB
static char *rpc_url;
static char *rpc_userpass;
static char *rpc_user, *rpc_pass;
char *opt_cert;
char *opt_proxy;
long opt_proxy_type;
struct thr_info *thr_info;
static int work_thr_id;
int longpoll_thr_id = -1;
int stratum_thr_id = -1;
struct work_restart *work_restart = NULL;
static struct stratum_ctx stratum;

pthread_mutex_t applog_lock;
pthread_mutex_t stats_lock;

static unsigned long accepted_count = 0L;
static unsigned long rejected_count = 0L;
double *thr_hashrates;

#ifdef HAVE_GETOPT_LONG
#include <getopt.h>
#else
struct option {
	const char *name;
	int has_arg;
	int *flag;
	int val;
};
#endif

// CB 
static char const usage[] = "\
Usage: " PROGRAM_NAME " [OPTIONS]\n\
Options:\n\
  -a, --algo=ALGO       specify the algorithm to use (default is scrypt)\n\
                          scrypt       scrypt Salsa20/8(1024, 1, 1), PBKDF2(SHA2)\n\
                          scrypt:N     scrypt Salsa20/8(N, 1, 1), PBKDF2(SHA2)\n\
                          scrypt-jane  scrypt Chacha20/8(N, 1, 1), PBKDF2(Keccak)\n\
                          scrypt-jane:Coin\n\
                                       Coin must be one of the supported coins.\n\
                          scrypt-jane:Nfactor\n\
                                       scrypt-chacha20/8(2*2^Nfactor, 1, 1)\n\
                          scrypt-jane:StartTime,Nfmin,Nfmax\n\
                                       like above nFactor derived from Unix time.\n\
                          sha256d      SHA-256d (don't use this! No GPU acceleration)\n\
                          keccak       Keccak (SHA-3)\n\
                          blake        Blake\n\
  -o, --url=URL         URL of mining server (default: " DEF_RPC_URL ")\n\
  -O, --userpass=U:P    username:password pair for mining server\n\
  -u, --user=USERNAME   username for mining server\n\
  -p, --pass=PASSWORD   password for mining server\n\
      --cert=FILE       certificate for mining server using SSL\n\
  -x, --proxy=[PROTOCOL://]HOST[:PORT]  connect through a proxy\n\
  -t, --threads=N       number of miner threads (default: number of processors)\n\
  -r, --retries=N       number of times to retry if a network call fails\n\
                          (default: retry indefinitely)\n\
  -R, --retry-pause=N   time to pause between retries, in seconds (default: 30)\n\
  -T, --timeout=N       network timeout, in seconds (default: 270)\n\
  -s, --scantime=N      upper bound on time spent scanning current work when\n\
                        long polling is unavailable, in seconds (default: 5)\n\
      --no-longpoll     disable X-Long-Polling support\n\
      --no-stratum      disable X-Stratum support\n\
  -q, --quiet           disable per-thread hashmeter output\n\
  -D, --debug           enable debug output\n\
  -P, --protocol-dump   verbose dump of protocol-level activities\n\
      --no-autotune     disable auto-tuning of kernel launch parameters\n\
  -d, --devices         takes a comma separated list of CUDA devices to use.\n\
                        Device IDs start counting from 0! Alternatively takes\n\
                        string names of your cards like gtx780ti or gt640#2\n\
                        (matching 2nd gt640 in the PC)\n\
  -l, --launch-config   gives the launch configuration for each kernel\n\
                        in a comma separated list, one per device.\n\
  -i, --interactive     comma separated list of flags (0/1) specifying\n\
                        which of the CUDA device you need to run at inter-\n\
                        active frame rates (because it drives a display).\n\
  -b, --batchsize       comma separated list of max. scrypt iterations that\n\
                        are run in one kernel invocation. Default is 1024.\n\
                        Increase for better performance in scrypt-jane.\n\
  -C, --texture-cache   comma separated list of flags (0/1) specifying\n\
                        which of the CUDA devices shall use the texture\n\
                        cache for mining. Kepler devices will profit.\n\
  -m, --single-memory   comma separated list of flags (0/1) specifying\n\
                        which of the CUDA devices shall allocate their\n\
                        scrypt scratchbuffers in a single memory block.\n\
  -H, --hash-parallel   determines how the PBKDF2 based SHA2 or Keccak\n\
                        parts of scrypt and scrypt-jane are computed:\n\
                        0 hashes this single threaded on the CPU.\n\
                        1 to enable multithreaded hashing on the CPU.\n\
                        2 offloads everything to the GPU (default)\n\
  -L, --lookup-gap      Divides the per-hash memory requirement by this factor\n\
                        by storing only every N'th value in the scratchpad.\n\
                        Default is 1.\n\
      --time-limit      maximum time [s] to mine before exiting the program.\n"

#ifdef HAVE_SYSLOG_H
"\
  -S, --syslog          use system log for output messages\n"
#endif
#ifndef WIN32
"\
  -B, --background      run the miner in the background\n"
#endif
"\
      --benchmark       run in offline benchmark mode\n\
  -c, --config=FILE     load a JSON-format configuration file\n\
  -V, --version         display version information and exit\n\
  -h, --help            display this help text and exit\n\
";

static char const short_options[] =
#ifndef WIN32
	"B"
#endif
#ifdef HAVE_SYSLOG_H
	"S"
#endif
	"a:c:Dhp:Px:qr:R:s:t:T:o:u:O:Vd:l:i:b:C:m:H:L:"; // CB 

static struct option const options[] = {
	{ "algo", 1, NULL, 'a' },
#ifndef WIN32
	{ "background", 0, NULL, 'B' },
#endif
	{ "benchmark", 0, NULL, 1005 },
	{ "cert", 1, NULL, 1001 },
	{ "config", 1, NULL, 'c' },
	{ "debug", 0, NULL, 'D' },
	{ "help", 0, NULL, 'h' },
	{ "no-longpoll", 0, NULL, 1003 },
	{ "no-stratum", 0, NULL, 1007 },
	{ "pass", 1, NULL, 'p' },
	{ "protocol-dump", 0, NULL, 'P' },
	{ "proxy", 1, NULL, 'x' },
	{ "quiet", 0, NULL, 'q' },
	{ "retries", 1, NULL, 'r' },
	{ "retry-pause", 1, NULL, 'R' },
	{ "scantime", 1, NULL, 's' },
#ifdef HAVE_SYSLOG_H
	{ "syslog", 0, NULL, 'S' },
#endif
	{ "threads", 1, NULL, 't' },
	{ "timeout", 1, NULL, 'T' },
	{ "url", 1, NULL, 'o' },
	{ "user", 1, NULL, 'u' },
	{ "userpass", 1, NULL, 'O' },
	{ "version", 0, NULL, 'V' },
	{ "no-autotune", 0, NULL, 1004 }, // CB 
	{ "devices", 1, NULL, 'd' },
	{ "launch-config", 1, NULL, 'l' },
	{ "interactive", 1, NULL, 'i' },
	{ "texture-cache", 1, NULL, 'C' },
	{ "single-memory", 1, NULL, 'm' },
	{ "hash-parallel", 1, NULL, 'H' },
	{ "lookup-gap", 1, NULL, 'L' },
	{ "time-limit", 1, NULL, 1008 },
	{ 0, 0, 0, 0 }
};

struct work {
	uint32_t data[32];
	uint32_t target[8];

	char job_id[128];
	size_t xnonce2_len;
	unsigned char xnonce2[32];
};

static struct work g_work;
static time_t g_work_time;
static pthread_mutex_t g_work_lock;

static bool jobj_binary(const json_t *obj, const char *key,
			void *buf, size_t buflen)
{
	const char *hexstr;
	json_t *tmp;

	tmp = json_object_get(obj, key);
	if (unlikely(!tmp)) {
		applog(LOG_ERR, "JSON key '%s' not found", key);
		return false;
	}
	hexstr = json_string_value(tmp);
	if (unlikely(!hexstr)) {
		applog(LOG_ERR, "JSON key '%s' is not a string", key);
		return false;
	}
	if (!hex2bin((unsigned char*)buf, hexstr, buflen))
		return false;

	return true;
}

static bool work_decode(const json_t *val, struct work *work)
{
	int i;
	
	if (unlikely(!jobj_binary(val, "data", work->data, sizeof(work->data)))) {
		applog(LOG_ERR, "JSON inval data");
		goto err_out;
	}
	if (unlikely(!jobj_binary(val, "target", work->target, sizeof(work->target)))) {
		applog(LOG_ERR, "JSON inval target");
		goto err_out;
	}

	for (i = 0; i < ARRAY_SIZE(work->data); i++)
		work->data[i] = le32dec(work->data + i);
	for (i = 0; i < ARRAY_SIZE(work->target); i++)
		work->target[i] = le32dec(work->target + i);

	return true;

err_out:
	return false;
}

static void share_result(int result, const char *reason)
{
	char s[345];
	double hashrate;
	int i;

	hashrate = 0.;
	pthread_mutex_lock(&stats_lock);
	for (i = 0; i < opt_n_threads; i++)
		hashrate += thr_hashrates[i];
	result ? accepted_count++ : rejected_count++;
	pthread_mutex_unlock(&stats_lock);
	
	sprintf(s, hashrate >= 1e6 ? "%.0f" : "%.2f", 1e-3 * hashrate);
	applog(LOG_INFO, "accepted: %lu/%lu (%.2f%%), %s khash/s %s",
		   accepted_count,
		   accepted_count + rejected_count,
		   100. * accepted_count / (accepted_count + rejected_count),
		   s,
		   result ? "(yay!!!)" : "(booooo)");

	if (opt_debug && reason)
		applog(LOG_DEBUG, "DEBUG: reject reason: %s", reason);
}

static bool submit_upstream_work(CURL *curl, struct work *work)
{
	char *str = NULL;
	json_t *val, *res, *reason;
	char s[345];
	int i;
	bool rc = false;

	/* pass if the previous hash is not the current previous hash */
	if (!submit_old && memcmp(work->data + 1, g_work.data + 1, 32)) {
		if (opt_debug)
			applog(LOG_DEBUG, "DEBUG: stale work detected, discarding");
		return true;
	}

	if (have_stratum) {
		uint32_t ntime, nonce;
		char *ntimestr, *noncestr, *xnonce2str;

		if (!work->job_id)
			return true;
		le32enc(&ntime, work->data[17]);
		le32enc(&nonce, work->data[19]);
		ntimestr = bin2hex((const unsigned char *)(&ntime), 4);
		noncestr = bin2hex((const unsigned char *)(&nonce), 4);
		xnonce2str = bin2hex(work->xnonce2, work->xnonce2_len);
		sprintf(s,
			"{\"method\": \"mining.submit\", \"params\": [\"%s\", \"%s\", \"%s\", \"%s\", \"%s\"], \"id\":4}",
			rpc_user, work->job_id, xnonce2str, ntimestr, noncestr);
		free(ntimestr);
		free(noncestr);
		free(xnonce2str);

		if (unlikely(!stratum_send_line(&stratum, s))) {
			applog(LOG_ERR, "submit_upstream_work stratum_send_line failed");
			goto out;
		}
	} else {
		/* build hex string */
		for (i = 0; i < ARRAY_SIZE(work->data); i++)
			le32enc(work->data + i, work->data[i]);
		str = bin2hex((unsigned char *)work->data, sizeof(work->data));
		if (unlikely(!str)) {
			applog(LOG_ERR, "submit_upstream_work OOM");
			goto out;
		}

		/* build JSON-RPC request */
		sprintf(s,
			"{\"method\": \"getwork\", \"params\": [ \"%s\" ], \"id\":1}\r\n",
			str);

		/* issue JSON-RPC request */
		val = json_rpc_call(curl, rpc_url, rpc_userpass, s, false, false, NULL);
		if (unlikely(!val)) {
			applog(LOG_ERR, "submit_upstream_work json_rpc_call failed");
			goto out;
		}

		res = json_object_get(val, "result");
		reason = json_object_get(val, "reject-reason");
		share_result(json_is_true(res), reason ? json_string_value(reason) : NULL);

		json_decref(val);
	}

	rc = true;

out:
	free(str);
	return rc;
}

static const char *rpc_req =
	"{\"method\": \"getwork\", \"params\": [], \"id\":0}\r\n";

static bool get_upstream_work(CURL *curl, struct work *work)
{
	json_t *val;
	bool rc;
	struct timeval tv_start, tv_end, diff;

	gettimeofday(&tv_start, NULL);
	val = json_rpc_call(curl, rpc_url, rpc_userpass, rpc_req,
			    want_longpoll, false, NULL);
	gettimeofday(&tv_end, NULL);

	if (have_stratum) {
		if (val)
			json_decref(val);
		return true;
	}

	if (!val)
		return false;

	rc = work_decode(json_object_get(val, "result"), work);

	if (opt_debug && rc) {
		timeval_subtract(&diff, &tv_end, &tv_start);
		applog(LOG_DEBUG, "DEBUG: got new work in %d ms",
		       diff.tv_sec * 1000 + diff.tv_usec / 1000);
	}

	json_decref(val);

	return rc;
}

static void workio_cmd_free(struct workio_cmd *wc)
{
	if (!wc)
		return;

	switch (wc->cmd) {
	case WC_SUBMIT_WORK:
		free(wc->u.work);
		break;
	default: /* do nothing */
		break;
	}

	memset(wc, 0, sizeof(*wc));	/* poison */
	free(wc);
}

static bool workio_get_work(struct workio_cmd *wc, CURL *curl)
{
	struct work *ret_work;
	int failures = 0;

	ret_work = (struct work*)calloc(1, sizeof(*ret_work));
	if (!ret_work)
		return false;

	/* obtain new work from bitcoin via JSON-RPC */
	while (!get_upstream_work(curl, ret_work)) {
		if (unlikely((opt_retries >= 0) && (++failures > opt_retries))) {
			applog(LOG_ERR, "json_rpc_call failed, terminating workio thread");
			free(ret_work);
			return false;
		}

		/* pause, then restart work-request loop */
		applog(LOG_ERR, "json_rpc_call failed, retry after %d seconds",
			opt_fail_pause);
		sleep(opt_fail_pause);
	}

	/* send work to requesting thread */
	if (!tq_push(wc->thr->q, ret_work))
		free(ret_work);

	return true;
}

static bool workio_submit_work(struct workio_cmd *wc, CURL *curl)
{
	int failures = 0;

	/* submit solution to bitcoin via JSON-RPC */
	while (!submit_upstream_work(curl, wc->u.work)) {
		if (unlikely((opt_retries >= 0) && (++failures > opt_retries))) {
			applog(LOG_ERR, "...terminating workio thread");
			return false;
		}

		/* pause, then restart work-request loop */
		applog(LOG_ERR, "...retry after %d seconds",
			opt_fail_pause);
		sleep(opt_fail_pause);
	}

	return true;
}

static void *workio_thread(void *userdata)
{
	struct thr_info *mythr = (struct thr_info *)userdata;
	CURL *curl;
	bool ok = true;

	curl = curl_easy_init();
	if (unlikely(!curl)) {
		applog(LOG_ERR, "CURL initialization failed");
		return NULL;
	}

	while (ok) {
		struct workio_cmd *wc;

		/* wait for workio_cmd sent to us, on our queue */
		wc = (struct workio_cmd *)tq_pop(mythr->q, NULL);
		if (!wc) {
			ok = false;
			break;
		}

		/* process workio_cmd */
		switch (wc->cmd) {
		case WC_GET_WORK:
			ok = workio_get_work(wc, curl);
			break;
		case WC_SUBMIT_WORK:
			ok = workio_submit_work(wc, curl);
			break;
		case WC_ABORT:  // CB 
		default:		/* should never happen */
			ok = false;
			break;
		}

		workio_cmd_free(wc);
	}

	tq_freeze(mythr->q);
	curl_easy_cleanup(curl);

	return NULL;
}

static void workio_abort() // CB 
{
	struct workio_cmd *wc;

	/* fill out work request message */
	wc = (struct workio_cmd *)calloc(1, sizeof(*wc));
	if (!wc)
		return;

	wc->cmd = WC_ABORT;

	/* send work request to workio thread */
	if (!tq_push(thr_info[work_thr_id].q, wc)) {
		workio_cmd_free(wc);
	}
}

static bool get_work(struct thr_info *thr, struct work *work)
{
	struct workio_cmd *wc;
	struct work *work_heap;

	if (opt_benchmark) {
		memset(work->data, 0x55, 76);
		work->data[17] = swab32((uint32_t)time(NULL));
		memset(work->data + 19, 0x00, 52);
		work->data[20] = 0x80000000;
		work->data[31] = 0x00000280;
		memset(work->target, 0x00, sizeof(work->target));
		return true;
	}

	/* fill out work request message */
	wc = (struct workio_cmd *)calloc(1, sizeof(*wc));
	if (!wc)
		return false;

	wc->cmd = WC_GET_WORK;
	wc->thr = thr;

	/* send work request to workio thread */
	if (!tq_push(thr_info[work_thr_id].q, wc)) {
		workio_cmd_free(wc);
		return false;
	}

	/* wait for response, a unit of work */
	work_heap = (struct work *)tq_pop(thr->q, NULL);
	if (!work_heap)
		return false;

	/* copy returned work into storage provided by caller */
	memcpy(work, work_heap, sizeof(*work));
	free(work_heap);

	return true;
}

static bool submit_work(struct thr_info *thr, const struct work *work_in)
{
	struct workio_cmd *wc;
	
	/* fill out work request message */
	wc = (struct workio_cmd *)calloc(1, sizeof(*wc));
	if (!wc)
		return false;

	wc->u.work = (struct work *)malloc(sizeof(*work_in));
	if (!wc->u.work)
		goto err_out;

	wc->cmd = WC_SUBMIT_WORK;
	wc->thr = thr;
	memcpy(wc->u.work, work_in, sizeof(*work_in));

	/* send solution to workio thread */
	if (!tq_push(thr_info[work_thr_id].q, wc))
		goto err_out;

	return true;

err_out:
	workio_cmd_free(wc);
	return false;
}

static void stratum_gen_work(struct stratum_ctx *sctx, struct work *work)
{
	unsigned char merkle_root[64];
	int i;

	pthread_mutex_lock(&sctx->work_lock);

	strcpy(work->job_id, sctx->job.job_id);
	work->xnonce2_len = sctx->xnonce2_size;
	memcpy(work->xnonce2, sctx->job.xnonce2, sctx->xnonce2_size);

	/* Generate merkle root */
	if (opt_algo != ALGO_KECCAK && opt_algo != ALGO_BLAKE) // CB: fix for stratum pools with MaxCoin and Blake
		sha256d(merkle_root, sctx->job.coinbase, (int)sctx->job.coinbase_size);
	else
		SHA256((unsigned char*)sctx->job.coinbase, sctx->job.coinbase_size, (unsigned char*)merkle_root);
	for (i = 0; i < sctx->job.merkle_count; i++) {
		memcpy(merkle_root + 32, sctx->job.merkle[i], 32);
		sha256d(merkle_root, merkle_root, 64);
	}
	
	/* Increment extranonce2 */
	for (i = 0; i < (int)sctx->xnonce2_size && !++sctx->job.xnonce2[i]; i++);

	/* Assemble block header */
	memset(work->data, 0, 128);
	work->data[0] = le32dec(sctx->job.version);
	for (i = 0; i < 8; i++)
		work->data[1 + i] = le32dec((uint32_t *)sctx->job.prevhash + i);
	for (i = 0; i < 8; i++)
		work->data[9 + i] = be32dec((uint32_t *)merkle_root + i);
	work->data[17] = le32dec(sctx->job.ntime);
	work->data[18] = le32dec(sctx->job.nbits);
	work->data[20] = 0x80000000;
	work->data[31] = 0x00000280;

	pthread_mutex_unlock(&sctx->work_lock);

	if (opt_debug) {
		char *xnonce2str = bin2hex(work->xnonce2, sctx->xnonce2_size);
		applog(LOG_DEBUG, "DEBUG: job_id='%s' extranonce2=%s ntime=%08x",
		       work->job_id, xnonce2str, swab32(work->data[17]));
		free(xnonce2str);
	}

	if (opt_algo == ALGO_SCRYPT || opt_algo == ALGO_SCRYPT_JANE)
		diff_to_target(work->target, sctx->job.diff / 65536.0);
	else if (opt_algo == ALGO_KECCAK)
		diff_to_target(work->target, sctx->job.diff / 256.0);
	else
		diff_to_target(work->target, sctx->job.diff);
}

static void *miner_thread(void *userdata)
{
	struct thr_info *mythr = (struct thr_info *)userdata;
	int thr_id = mythr->id;
	struct work work;
	uint32_t max_nonce;
	uint32_t end_nonce = 0xffffffffU / opt_n_threads * (thr_id + 1) - 0x20;
	// CB 
	char s[16];
	int i;
	memset(&work, 0, sizeof(work)); // CB fix uninitialized variable problem

	/* Set worker threads to nice 19 and then preferentially to SCHED_IDLE
	 * and if that fails, then SCHED_BATCH. No need for this to be an
	 * error if it fails */
	if (!opt_benchmark) {
		setpriority(PRIO_PROCESS, 0, 19);
		drop_policy();
	}

	if (!parallel) // CB
	{
		if (!opt_quiet)
			applog(LOG_INFO, "Binding thread %d to cpu %d",
			       thr_id, thr_id % num_processors);
		affine_to_cpu(thr_id, thr_id % num_processors);
	}

	do { // CB
		unsigned long hashes_done;
		struct timeval tv_start, tv_end, diff;
		int64_t max64;
		int rc;

		if (have_stratum) {
			while (!*g_work.job_id || time(NULL) >= g_work_time + 120)
				sleep(1);
			pthread_mutex_lock(&g_work_lock);
			if (work.data[19] >= end_nonce) {
				stratum_gen_work(&stratum, &g_work);
			}
		} else {
			/* obtain new work from internal workio thread */
			pthread_mutex_lock(&g_work_lock);
			if (!(have_longpoll || have_stratum) ||
					time(NULL) >= g_work_time + LP_SCANTIME*3/4 ||
					work.data[19] >= end_nonce) {
				if (unlikely(!get_work(mythr, &g_work))) {
					applog(LOG_ERR, "work retrieval failed, exiting "
						"mining thread %d", mythr->id);
					pthread_mutex_unlock(&g_work_lock);
					goto out;
				}
				time(&g_work_time);
			}
			if (have_stratum) {
				pthread_mutex_unlock(&g_work_lock);
				continue;
			}
		}
		if (memcmp(work.data, g_work.data, 76)) {
			memcpy(&work, &g_work, sizeof(struct work));
			work.data[19] = 0xffffffffU / opt_n_threads * thr_id;
		} else
			work.data[19]++;
		pthread_mutex_unlock(&g_work_lock);
		work_restart[thr_id].restart = 0;
		
		static bool firstwork = true;
		static time_t firstwork_time;

		/* adjust max_nonce to meet target scan time */
		if (have_stratum)
			max64 = LP_SCANTIME;
		else
			max64 = g_work_time + (have_longpoll ? LP_SCANTIME : opt_scantime)
			      - time(NULL);
		if (opt_time_limit && firstwork == false) // CB
		{
			int passed = (int)(time(NULL) - firstwork_time);
			int remain = (int)(opt_time_limit - passed);
			if (remain < 0) { abort_flag = true; workio_abort(); break; }
			if (remain < max64) max64 = remain;
		}
		max64 *= (int64_t)thr_hashrates[thr_id];
		if (max64 <= 0)
			max64 = opt_algo == (ALGO_SCRYPT || opt_algo == ALGO_SCRYPT_JANE) ? 0xfffLL : 0x1fffffLL; // CB
		if ((int64_t)work.data[19] + max64 > end_nonce)
			max_nonce = end_nonce;
		else
			max_nonce = (uint32_t)(work.data[19] + max64);
		
		hashes_done = 0;
		// CB

		/* scan nonces for a proof-of-work hash */
		switch (opt_algo) {
		case ALGO_SCRYPT:
			rc = scanhash_scrypt(thr_id, work.data, work.target,  // CB
			                     max_nonce, &tv_start, &tv_end, &hashes_done);
			break;

		case ALGO_SCRYPT_JANE:
			rc = scanhash_scrypt_jane(thr_id, work.data, work.target,  // CB
			                     max_nonce, &tv_start, &tv_end, &hashes_done);
			break;

		case ALGO_SHA256D:
			rc = scanhash_sha256d(thr_id, work.data, work.target, // CB
			                      max_nonce, &tv_start, &tv_end, &hashes_done);
			break;

		case ALGO_KECCAK:
			rc = scanhash_keccak(thr_id, work.data, work.target,
			                      max_nonce, &tv_start, &tv_end, &hashes_done);
			break;

		case ALGO_BLAKE:
			rc = scanhash_blake(thr_id, work.data, work.target,
			                    max_nonce, &tv_start, &tv_end, &hashes_done);
			break;

		default:
			/* should never happen */
			goto out;
		}

		if (firstwork) // CB
		{
			time(&firstwork_time);
			firstwork = false;
		}
		
		// CB
		/* record scanhash elapsed time */
		timeval_subtract(&diff, &tv_end, &tv_start);
		if (diff.tv_usec || diff.tv_sec) {
			pthread_mutex_lock(&stats_lock);
			thr_hashrates[thr_id] =
				hashes_done / (diff.tv_sec + 1e-6 * diff.tv_usec);
			pthread_mutex_unlock(&stats_lock);
		}
		if (!opt_quiet && !abort_flag) { // CB
			sprintf(s, thr_hashrates[thr_id] >= 1e6 ? "%.0f" : "%.2f",
				1e-3 * thr_hashrates[thr_id]);
#if defined(USE_WRAPNVML)
                        if (nvmlh != NULL) {
                          unsigned int tempC=0, fanpcnt=0, mwatts=0;
                          char gputempbuf[64], gpufanbuf[64], gpupowbuf[64]; 
                          strcpy(gputempbuf, " N/A");
                          strcpy(gpufanbuf, " N/A");
                          strcpy(gpupowbuf, " N/A");

#if 1
                          if (wrap_nvml_get_tempC(nvmlh, device_map[thr_id], &tempC) == 0)
                            sprintf(gputempbuf, "%3dC", tempC);

                          if (wrap_nvml_get_fanpcnt(nvmlh, device_map[thr_id], &fanpcnt) == 0)
                            sprintf(gpufanbuf, "%3d%%", fanpcnt);

                          if (wrap_nvml_get_power_usage(nvmlh, device_map[thr_id], &mwatts) == 0)
                            sprintf(gpupowbuf, "%dW", (mwatts / 1000));
#endif

                          applog(LOG_INFO, "GPU #%d: %s, %s khash/s",
                                 device_map[thr_id], device_name[thr_id], s);
                          applog(LOG_INFO, "        Temp: %s  Fan speed: %s  Power: %s",
                                 gputempbuf, gpufanbuf, gpupowbuf);
                        } 
                        else
#endif
			applog(LOG_INFO, "GPU #%d: %s, %s khash/s",
				device_map[thr_id], device_name[thr_id], s);
		}
		if (opt_benchmark && thr_id == opt_n_threads - 1) {
			double hashrate = 0.;
			for (i = 0; i < opt_n_threads && thr_hashrates[i]; i++)
				hashrate += thr_hashrates[i];
			if (i == opt_n_threads) {
				sprintf(s, hashrate >= 1e6 ? "%.0f" : "%.2f", 1e-3 * hashrate);
				applog(LOG_INFO, "Total: %s khash/s", s);
			}
//			static int count = 0; if (++count >= 2) { abort_flag = true; workio_abort(); }
		}

		/* if nonce found, submit work */
		if (rc && !opt_benchmark && !submit_work(mythr, &work)) break;

	} while (!abort_flag); // CB

out:
	cuda_shutdown(thr_id); // CB
	tq_freeze(mythr->q);

	return NULL;
}

static void restart_threads(void)
{
	int i;

	for (i = 0; i < opt_n_threads; i++)
		work_restart[i].restart = 1;
}

static void *longpoll_thread(void *userdata)
{
	struct thr_info *mythr = (struct thr_info *)userdata;
	CURL *curl = NULL;
	char *copy_start, *hdr_path = NULL, *lp_url = NULL;
	bool need_slash = false;

	curl = curl_easy_init();
	if (unlikely(!curl)) {
		applog(LOG_ERR, "CURL initialization failed");
		goto out;
	}

start:
	hdr_path = (char*)tq_pop(mythr->q, NULL);
	if (!hdr_path)
		goto out;

	/* full URL */
	if (strstr(hdr_path, "://")) {
		lp_url = hdr_path;
		hdr_path = NULL;
	}
	
	/* absolute path, on current server */
	else {
		copy_start = (*hdr_path == '/') ? (hdr_path + 1) : hdr_path;
		if (rpc_url[strlen(rpc_url) - 1] != '/')
			need_slash = true;

		lp_url = (char*)malloc(strlen(rpc_url) + strlen(copy_start) + 2);
		if (!lp_url)
			goto out;

		sprintf(lp_url, "%s%s%s", rpc_url, need_slash ? "/" : "", copy_start);
	}

	applog(LOG_INFO, "Long-polling activated for %s", lp_url);

	while (!abort_flag) { // CB
		json_t *val, *soval;
		int err;

		val = json_rpc_call(curl, lp_url, rpc_userpass, rpc_req,
				    false, true, &err);
		if (have_stratum) {
			if (val)
				json_decref(val);
			goto out;
		}
		if (likely(val)) {
			if (!opt_quiet) applog(LOG_INFO, "LONGPOLL detected new block");
			soval = json_object_get(json_object_get(val, "result"), "submitold");
			submit_old = soval ? json_is_true(soval) : false;
			pthread_mutex_lock(&g_work_lock);
			if (work_decode(json_object_get(val, "result"), &g_work)) {
				if (opt_debug)
					applog(LOG_DEBUG, "DEBUG: got new work");
				time(&g_work_time);
				restart_threads();
			}
			pthread_mutex_unlock(&g_work_lock);
			json_decref(val);
		} else {
			pthread_mutex_lock(&g_work_lock);
			g_work_time -= LP_SCANTIME;
			pthread_mutex_unlock(&g_work_lock);
			if (err == CURLE_OPERATION_TIMEDOUT) {
				restart_threads();
			} else {
				have_longpoll = false;
				restart_threads();
				free(hdr_path);
				free(lp_url);
				lp_url = NULL;
				sleep(opt_fail_pause);
				goto start;
			}
		}
	}

out:
	free(hdr_path);
	free(lp_url);
	tq_freeze(mythr->q);
	if (curl)
		curl_easy_cleanup(curl);

	return NULL;
}

static bool stratum_handle_response(char *buf)
{
	json_t *val, *err_val, *res_val, *id_val;
	json_error_t err;
	bool ret = false;

	val = JSON_LOADS(buf, &err);
	if (!val) {
		applog(LOG_INFO, "JSON decode failed(%d): %s", err.line, err.text);
		goto out;
	}

	res_val = json_object_get(val, "result");
	err_val = json_object_get(val, "error");
	id_val = json_object_get(val, "id");

	if (!id_val || json_is_null(id_val) || !res_val)
		goto out;

	share_result(json_is_true(res_val),
		err_val ? json_string_value(json_array_get(err_val, 1)) : NULL);

	ret = true;
out:
	if (val)
		json_decref(val);

	return ret;
}

static void *stratum_thread(void *userdata)
{
	struct thr_info *mythr = (struct thr_info *)userdata;
	char *s;

	stratum.url = (char*)tq_pop(mythr->q, NULL);
	if (!stratum.url)
		goto out;
	applog(LOG_INFO, "Starting Stratum on %s", stratum.url);

	do { // CB
		int failures = 0;

		while (!stratum.curl) {
			pthread_mutex_lock(&g_work_lock);
			g_work_time = 0;
			pthread_mutex_unlock(&g_work_lock);
			restart_threads();

			if (!stratum_connect(&stratum, stratum.url) ||
			    !stratum_subscribe(&stratum) ||
			    !stratum_authorize(&stratum, rpc_user, rpc_pass)) {
				stratum_disconnect(&stratum);
				if (opt_retries >= 0 && ++failures > opt_retries) {
					applog(LOG_ERR, "...terminating workio thread");
					tq_push(thr_info[work_thr_id].q, NULL);
					goto out;
				}
				applog(LOG_ERR, "...retry after %d seconds", opt_fail_pause);
				sleep(opt_fail_pause);
			}
		}

		if (stratum.job.job_id &&
		    (strcmp(stratum.job.job_id, g_work.job_id) || !g_work_time)) {
			pthread_mutex_lock(&g_work_lock);
			stratum_gen_work(&stratum, &g_work);
			time(&g_work_time);
			pthread_mutex_unlock(&g_work_lock);
			if (stratum.job.clean) {
				if (!opt_quiet) applog(LOG_INFO, "Stratum detected new block");
				restart_threads();
			}
		}
		
		if (!stratum_socket_full(&stratum, 120)) {
			if (!abort_flag) applog(LOG_ERR, "Stratum connection timed out");
			s = NULL;
		} else
			s = stratum_recv_line(&stratum);
		if (!s) {
			stratum_disconnect(&stratum);
			if (!abort_flag) applog(LOG_ERR, "Stratum connection interrupted");
			continue;
		}
		if (!stratum_handle_method(&stratum, s))
			stratum_handle_response(s);
		free(s);
	} while (!abort_flag);

out:
	return NULL;
}

static void show_version_and_exit(void)
{
	printf("%s\n%s\n", PACKAGE_STRING, curl_version());
	exit(0);
}

static void show_usage_and_exit(int status)
{
	if (status)
		fprintf(stderr, "Try `" PROGRAM_NAME " --help' for more information.\n");
	else
		printf(usage);
	exit(status);
}

static void parse_arg (int key, char *arg)
{
	char *p;
	int v, i;

	switch(key) {
	case 'a':
		for (i = 0; i < ARRAY_SIZE(algo_names); i++) {
			if (algo_names[i] &&
			    !strcmp(arg, algo_names[i])) {
				opt_algo = (enum sha256_algos)i;
				break;
			}
		}
		if (i == ARRAY_SIZE(algo_names)) { // CB
			if (!strncmp(arg, algo_names[ALGO_SCRYPT], strlen(algo_names[ALGO_SCRYPT])) && arg[strlen(algo_names[ALGO_SCRYPT])] == ':')
			{
				N = atoi(&arg[strlen(algo_names[ALGO_SCRYPT])+1]);
				opt_algo = ALGO_SCRYPT;
			}
			else if (!strncmp(arg, algo_names[ALGO_SCRYPT_JANE], strlen(algo_names[ALGO_SCRYPT_JANE])) && arg[strlen(algo_names[ALGO_SCRYPT_JANE])] == ':')
			{
				jane_params = strdup(&arg[strlen(algo_names[ALGO_SCRYPT_JANE])+1]);
				opt_algo = ALGO_SCRYPT_JANE;
			}
			else show_usage_and_exit(1);
		}
		break;
	case 'B':
		opt_background = true;
		break;
	case 'c': {
		json_error_t err;
		if (opt_config)
			json_decref(opt_config);
#if JANSSON_VERSION_HEX >= 0x020000
		opt_config = json_load_file(arg, 0, &err);
#else
		opt_config = json_load_file(arg, &err);
#endif
		if (!json_is_object(opt_config)) {
			applog(LOG_ERR, "JSON decode of %s failed", arg);
			exit(1);
		}
		break;
	}
	case 'q':
		opt_quiet = true;
		break;
	case 'D':
		opt_debug = true;
		break;
	case 'p':
		free(rpc_pass);
		rpc_pass = strdup(arg);
		break;
	case 'P':
		opt_protocol = true;
		break;
	case 'r':
		v = atoi(arg);
		if (v < -1 || v > 9999)	/* sanity check */
			show_usage_and_exit(1);
		opt_retries = v;
		break;
	case 'R':
		v = atoi(arg);
		if (v < 1 || v > 9999)	/* sanity check */
			show_usage_and_exit(1);
		opt_fail_pause = v;
		break;
	case 's':
		v = atoi(arg);
		if (v < 1 || v > 9999)	/* sanity check */
			show_usage_and_exit(1);
		opt_scantime = v;
		break;
	case 'T':
		v = atoi(arg);
		if (v < 1 || v > 99999)	/* sanity check */
			show_usage_and_exit(1);
		opt_timeout = v;
		break;
	case 't':
		v = atoi(arg);
		if (v < 1 || v > 9999)	/* sanity check */
			show_usage_and_exit(1);
		if (v > num_gpus)
		{
			applog(LOG_ERR, "Threads in -t option (%d) > no. of CUDA devices (%d)!", v, num_gpus);
			exit(1);
		}
		break;
	case 'u':
		free(rpc_user);
		rpc_user = strdup(arg);
		break;
	case 'o':			/* --url */
		p = strstr(arg, "://");
		if (p) {
			if (strncasecmp(arg, "http://", 7) && strncasecmp(arg, "https://", 8) &&
					strncasecmp(arg, "stratum+tcp://", 14))
				show_usage_and_exit(1);
			free(rpc_url);
			rpc_url = strdup(arg);
			if (strncasecmp(arg, "http://", 7)==0 || strncasecmp(arg, "https://", 8)==0) // CB
				want_stratum = false;
		} else {
			if (!strlen(arg) || *arg == '/')
				show_usage_and_exit(1);
			free(rpc_url);
			rpc_url = (char*)malloc(strlen(arg) + 8);
			sprintf(rpc_url, "http://%s", arg);
			want_stratum = false; // CB
		}
		p = strrchr(rpc_url, '@');
		if (p) {
			char *sp, *ap;
			*p = '\0';
			ap = strstr(rpc_url, "://") + 3;
			sp = strchr(ap, ':');
			if (sp) {
				free(rpc_userpass);
				rpc_userpass = strdup(ap);
				free(rpc_user);
				rpc_user = (char*)calloc(sp - ap + 1, 1);
				strncpy(rpc_user, ap, sp - ap);
				free(rpc_pass);
				rpc_pass = strdup(sp + 1);
			} else {
				free(rpc_user);
				rpc_user = strdup(ap);
			}
			memmove(ap, p + 1, strlen(p + 1) + 1);
		}
		have_stratum = !opt_benchmark && !strncasecmp(rpc_url, "stratum", 7);
		break;
	case 'O':			/* --userpass */
		p = strchr(arg, ':');
		if (!p)
			show_usage_and_exit(1);
		free(rpc_userpass);
		rpc_userpass = strdup(arg);
		free(rpc_user);
		rpc_user = (char*)calloc(p - arg + 1, 1);
		strncpy(rpc_user, arg, p - arg);
		free(rpc_pass);
		rpc_pass = strdup(p + 1);
		break;
	case 'x':			/* --proxy */
		if (!strncasecmp(arg, "socks4://", 9))
			opt_proxy_type = CURLPROXY_SOCKS4;
		else if (!strncasecmp(arg, "socks5://", 9))
			opt_proxy_type = CURLPROXY_SOCKS5;
#if LIBCURL_VERSION_NUM >= 0x071200
		else if (!strncasecmp(arg, "socks4a://", 10))
			opt_proxy_type = CURLPROXY_SOCKS4A;
		else if (!strncasecmp(arg, "socks5h://", 10))
			opt_proxy_type = CURLPROXY_SOCKS5_HOSTNAME;
#endif
		else
			opt_proxy_type = CURLPROXY_HTTP;
		free(opt_proxy);
		opt_proxy = strdup(arg);
		break;
	case 1001:
		free(opt_cert);
		opt_cert = strdup(arg);
		break;
	case 1005:
		opt_benchmark = true;
		want_longpoll = false;
		want_stratum = false;
		have_stratum = false;
		break;
	case 1003:
		want_longpoll = false;
		break;
	case 1007:
		want_stratum = false;
		break;
	case 1004: // CB
		autotune = false;
		break;
	case 'S':
		use_syslog = true;
		break;
	case 'd': // CB
		{
			char * pch = strtok (arg,",");
			opt_n_threads = 0;
			while (pch != NULL) {
				if (pch[0] >= '0' && pch[0] <= '9' && pch[1] == '\0')
				{
					if (atoi(pch) < num_gpus)
						device_map[opt_n_threads++] = atoi(pch);
					else {
						applog(LOG_ERR, "Non-existant CUDA device #%d specified in -d option", atoi(pch));
						exit(1);
					}
				} else {
					int device = cuda_finddevice(pch);
					if (device >= 0 && device < num_gpus)
						device_map[opt_n_threads++] = device;
					else {
						applog(LOG_ERR, "Non-existant CUDA device '%s' specified in -d option", pch);
						exit(1);
					}
				}
				pch = strtok (NULL, ",");
			}
		}
		break;
	case 'l':
		{
			char * pch = strtok (arg,",");
			int tmp_n_threads = 0; char *last = 0;
			while (pch != NULL) {
				device_config[tmp_n_threads++] = last = strdup(pch);
				pch = strtok (NULL, ",");
			}
			while (tmp_n_threads < 8) device_config[tmp_n_threads++] = last;
		}
		break;
	case 'i':
		{
			char * pch = strtok (arg,",");
			int tmp_n_threads = 0, last = 0;
			while (pch != NULL) {
				device_interactive[tmp_n_threads++] = last = atoi(pch);
				pch = strtok (NULL, ",");
			}
			while (tmp_n_threads < 8) device_interactive[tmp_n_threads++] = last;
		}
		break;
	case 'b':
		{
			char * pch = strtok (arg,",");
			int tmp_n_threads = 0, last = 0;
			while (pch != NULL) {
				device_batchsize[tmp_n_threads++] = last = atoi(pch);
				pch = strtok (NULL, ",");
			}
			while (tmp_n_threads < 8) device_batchsize[tmp_n_threads++] = last;
		}
		break;
	case 'C':
		{
			char * pch = strtok (arg,",");
			int tmp_n_threads = 0, last = 0;
			while (pch != NULL) {
				device_texturecache[tmp_n_threads++] = last = atoi(pch);
				pch = strtok (NULL, ",");
			}
			while (tmp_n_threads < 8) device_texturecache[tmp_n_threads++] = last;
		}
		break;
	case 'm':
		{
			char * pch = strtok (arg,",");
			int tmp_n_threads = 0, last = 0;
			while (pch != NULL) {
				device_singlememory[tmp_n_threads++] = last = atoi(pch);
				pch = strtok (NULL, ",");
			}
			while (tmp_n_threads < 8) device_singlememory[tmp_n_threads++] = last;
		}
		break;
	case 'H':
		{
			parallel = atoi(arg);
		}
		break;
	case 'L':
		{
			char * pch = strtok (arg,",");
			int tmp_n_threads = 0, last = 0;
			while (pch != NULL) {
				device_lookup_gap[tmp_n_threads++] = last = atoi(pch);
				pch = strtok (NULL, ",");
			}
			while (tmp_n_threads < 8) device_lookup_gap[tmp_n_threads++] = last;
		}
		break;
	case 1008:
		opt_time_limit = atoi(arg);
		break;
	case 'V':
		show_version_and_exit();
	case 'h':
		show_usage_and_exit(0);
	default:
		show_usage_and_exit(1);
	}
}

static void parse_config(void)
{
	int i;
	json_t *val;

	if (!json_is_object(opt_config))
		return;

	for (i = 0; i < ARRAY_SIZE(options); i++) {
		if (!options[i].name)
			break;
		if (!strcmp(options[i].name, "config"))
			continue;

		val = json_object_get(opt_config, options[i].name);
		if (!val)
			continue;

		if (options[i].has_arg && json_is_string(val)) {
			char *s = strdup(json_string_value(val));
			if (!s)
				break;
			parse_arg(options[i].val, s);
			free(s);
		} else if (!options[i].has_arg && json_is_true(val))
			parse_arg(options[i].val, "");
		else
			applog(LOG_ERR, "JSON option %s invalid",
				options[i].name);
	}
}

static void parse_cmdline(int argc, char *argv[])
{
	int key;

	while (1) {
#if HAVE_GETOPT_LONG
		key = getopt_long(argc, argv, short_options, options, NULL);
#else
		key = getopt(argc, argv, short_options);
#endif
		if (key < 0)
			break;

		parse_arg(key, optarg);
	}
	if (optind < argc) {
		fprintf(stderr, "%s: unsupported non-option argument '%s'\n",
			argv[0], argv[optind]);
		show_usage_and_exit(1);
	}

	parse_config();
}

#ifndef WIN32
void signal_handler(int sig)
{
	switch (sig) {
	case SIGHUP:
		applog(LOG_INFO, "SIGHUP received");
		break;
	case SIGINT:
		applog(LOG_INFO, "SIGINT received, exiting");
		exit(0);
		break;
	case SIGTERM:
		applog(LOG_INFO, "SIGTERM received, exiting");
		exit(0);
		break;
	}
}
#else // CB
BOOL CtrlHandler( DWORD fdwCtrlType ) 
{
  bool result = (abort_flag == false);
  switch( fdwCtrlType ) 
  { 
    case CTRL_C_EVENT: 
      if (result) fprintf(stderr, "Ctrl-C\n" );
      abort_flag = true; restart_threads(); workio_abort();
      return( result );

    case CTRL_CLOSE_EVENT: 
      if (result) fprintf(stderr, "Ctrl-Close\n" );
      abort_flag = true; restart_threads(); workio_abort();
      sleep(1);
      return( result ); 
 
    case CTRL_BREAK_EVENT: 
      if (result) fprintf(stderr, "Ctrl-Break\n" );
      abort_flag = true; restart_threads(); workio_abort();
      return( result ); 
 
    case CTRL_LOGOFF_EVENT: 
      if (result) fprintf(stderr, "Ctrl-Logoff\n" );
      abort_flag = true; restart_threads(); workio_abort();
      return( result ); 
 
    case CTRL_SHUTDOWN_EVENT: 
      if (result) fprintf(stderr, "Ctrl-Shutdown\n" );
      abort_flag = true; restart_threads(); workio_abort();
      return( result ); 
  }
  return ( FALSE );
}
#endif

int main(int argc, char *argv[])
{
	struct thr_info *thr;
	long flags;
	int i;

	// CB
	printf("\t   *** CudaMiner for nVidia GPUs by Christian Buchner ***\n");
	printf("\t             This is version "PROGRAM_VERSION" (beta)\n");
	printf("\tbased on pooler-cpuminer 2.3.2 (c) 2010 Jeff Garzik, 2012 pooler\n");
	printf("\t    Cuda additions Copyright 2013,2014 Christian Buchner\n");
	printf("\t  LTC donation address: LKS1WDKGED647msBQfLBHV3Ls8sveGncnm\n");
	printf("\t  BTC donation address: 16hJF5mceSojnTD3ZTUDqdRhDyPJzoRakM\n");
	printf("\t  YAC donation address: Y87sptDEcpLkLeAuex6qZioDbvy1qXZEj4\n");

	rpc_url = strdup(DEF_RPC_URL);
	rpc_user = strdup("");
	rpc_pass = strdup("");

	pthread_mutex_init(&applog_lock, NULL);

	num_gpus = cuda_num_devices(); // CB
	if (num_gpus == 0) {
		applog(LOG_ERR, "There are no CUDA devices in your system!");
		exit(1);
	}

	/* parse command line */
	parse_cmdline(argc, argv);

	pthread_mutex_init(&stats_lock, NULL);
	pthread_mutex_init(&g_work_lock, NULL);
	pthread_mutex_init(&stratum.sock_lock, NULL);
	pthread_mutex_init(&stratum.work_lock, NULL);

	flags = strncmp(rpc_url, "https:", 6)
	      ? (CURL_GLOBAL_ALL & ~CURL_GLOBAL_SSL)
	      : CURL_GLOBAL_ALL;
	if (curl_global_init(flags)) {
		applog(LOG_ERR, "CURL initialization failed");
		return 1;
	}

#ifndef WIN32
	if (opt_background) {
		i = fork();
		if (i < 0) exit(1);
		if (i > 0) exit(0);
		i = setsid();
		if (i < 0)
			applog(LOG_ERR, "setsid() failed (errno = %d)", errno);
		i = chdir("/");
		if (i < 0)
			applog(LOG_ERR, "chdir() failed (errno = %d)", errno);
		signal(SIGHUP, signal_handler);
		signal(SIGINT, signal_handler);
		signal(SIGTERM, signal_handler);
	}
#else // CB
    if( SetConsoleCtrlHandler( (PHANDLER_ROUTINE) CtrlHandler, TRUE ) ) 
    {

    }
#endif

#if defined(WIN32)
	SYSTEM_INFO sysinfo;
	GetSystemInfo(&sysinfo);
	num_processors = sysinfo.dwNumberOfProcessors;
#elif defined(_SC_NPROCESSORS_CONF)
	num_processors = sysconf(_SC_NPROCESSORS_CONF);
#elif defined(HW_NCPU)
	int req[] = { CTL_HW, HW_NCPU };
	size_t len = sizeof(num_processors);
	v = sysctl(req, 2, &num_processors, &len, NULL, 0);
#else
	num_processors = 1;
#endif
	if (num_processors < 1)
		num_processors = 1;

	if (!opt_n_threads)
		opt_n_threads = num_gpus; // CB

	if (!rpc_userpass) {
		rpc_userpass = (char*)malloc(strlen(rpc_user) + strlen(rpc_pass) + 2);
		if (!rpc_userpass)
			return 1;
		sprintf(rpc_userpass, "%s:%s", rpc_user, rpc_pass);
	}

#ifdef HAVE_SYSLOG_H
	if (use_syslog)
		openlog("cpuminer", LOG_PID, LOG_USER);
#endif

	work_restart = (struct work_restart *)calloc(opt_n_threads, sizeof(*work_restart));
	if (!work_restart)
		return 1;

	thr_info = (struct thr_info *)calloc(opt_n_threads + 3, sizeof(*thr));
	if (!thr_info)
		return 1;
	
	thr_hashrates = (double *) calloc(opt_n_threads, sizeof(double));
	if (!thr_hashrates)
		return 1;

	/* init workio thread info */
	work_thr_id = opt_n_threads;
	thr = &thr_info[work_thr_id];
	thr->id = work_thr_id;
	thr->q = tq_new();
	if (!thr->q)
		return 1;

	/* start work I/O thread */
	if (pthread_create(&thr->pth, NULL, workio_thread, thr)) {
		applog(LOG_ERR, "workio thread create failed");
		return 1;
	}

	if (want_longpoll && !have_stratum) {
		/* init longpoll thread info */
		longpoll_thr_id = opt_n_threads + 1;
		thr = &thr_info[longpoll_thr_id];
		thr->id = longpoll_thr_id;
		thr->q = tq_new();
		if (!thr->q)
			return 1;

		/* start longpoll thread */
		if (unlikely(pthread_create(&thr->pth, NULL, longpoll_thread, thr))) {
			applog(LOG_ERR, "longpoll thread create failed");
			return 1;
		}
	}
	if (want_stratum) {
		/* init stratum thread info */
		stratum_thr_id = opt_n_threads + 2;
		thr = &thr_info[stratum_thr_id];
		thr->id = stratum_thr_id;
		thr->q = tq_new();
		if (!thr->q)
			return 1;

		/* start stratum thread */
		if (unlikely(pthread_create(&thr->pth, NULL, stratum_thread, thr))) {
			applog(LOG_ERR, "stratum thread create failed");
			return 1;
		}

		if (have_stratum)
			tq_push(thr_info[stratum_thr_id].q, strdup(rpc_url));
	}

#if defined(USE_WRAPNVML)
        nvmlh = wrap_nvml_create();
        if (nvmlh == NULL) {
          applog(LOG_INFO, "NVML GPU monitoring is not available.");
        } else {
          applog(LOG_INFO, "NVML GPU temperature, fan, power monitoring enabled.");
        }
#endif
	/* start mining threads */
	for (i = 0; i < opt_n_threads; i++) {
		thr = &thr_info[i];

		thr->id = i;
		thr->q = tq_new();
		if (!thr->q)
			return 1;

		if (unlikely(pthread_create(&thr->pth, NULL, miner_thread, thr))) {
			applog(LOG_ERR, "thread %d create failed", i);
			return 1;
		}
	}

	applog(LOG_INFO, "%d miner threads started, "
		"using '%s' algorithm.",
		opt_n_threads,
		algo_names[opt_algo]);

	/* main loop - simply wait for stratum / workio thread to exit */
	if (want_stratum)
		pthread_join(thr_info[stratum_thr_id].pth, NULL);
	else
		pthread_join(thr_info[work_thr_id].pth, NULL);

#if defined(USE_WRAPNVML)
        if (nvmlh != NULL) {
          wrap_nvml_destroy(nvmlh);
          applog(LOG_INFO, "Closing down NVML GPU monitoring.");
         
        }
#endif
	applog(LOG_INFO, "workio thread dead, waiting for workers..."); // CB

	// CB
	abort_flag = true; restart_threads();
	for (i = 0; i < opt_n_threads; i++)
		pthread_join(thr_info[i].pth, NULL);

	applog(LOG_INFO, "worker threads all shut down, exiting.");

	return 0;
}
