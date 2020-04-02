#ifndef __COMPAT_H__
#define __COMPAT_H__

#ifdef WIN32

#include <windows.h>

static __inline void sleep(int secs)
{
	Sleep(secs * 1000);
}

enum {
	PRIO_PROCESS		= 0,
};

static __inline int setpriority(int which, int who, int prio)
{
	return -!SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_TIME_CRITICAL);
}

#endif /* WIN32 */

#endif /* __COMPAT_H__ */
