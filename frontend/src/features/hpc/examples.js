// Standalone native programs, shared by the editor, downloads and native verification script.
// C owns calloc/free buffers; C++ owns std::vector buffers and uses steady_clock.
const bodies = {
  correctness: `int main(int argc, char **argv) {
  const int n = argument(argc, argv, 1, 1000, 1000000);
  float single = 100000000.0f;
  double wide = 100000000.0;
  for (int i = 0; i < n; ++i) { single += 1.0f; wide += 1.0; }
  single -= 100000000.0f; wide -= 100000000.0;
  printf("float_sum=%.0f double_sum=%.0f reference=%d\\n", (double)single, wide, n);
  /* The deliberately inaccurate float sum is an observation, not our oracle. */
  if (wide != (double)n) { puts("FAIL double reference"); return 1; }
  puts("PASS double reference; inspect the float error before optimizing");
  return 0;
}
`,
  benchmark: `NOINLINE double serial_sum(const double *x, int n) {
  double s = 0.0;
  for (int i = 0; i < n; ++i) s += x[i];
  return s;
}
NOINLINE double two_sums(const double *x, int n) {
  double a = 0.0, b = 0.0;
  int i = 0;
  for (; i + 1 < n; i += 2) { a += x[i]; b += x[i + 1]; }
  if (i < n) a += x[i];
  return a + b;
}
int main(int argc, char **argv) {
  const int n = argument(argc, argv, 1, 100000, 10000000);
  const int samples = argument(argc, argv, 2, 7, 100);
  BUFFER(double, x, n);
  for (int i = 0; i < n; ++i) x[i] = (double)(i % 31);
  const double reference = serial_sum(x, n);
  puts("sample,baseline_ms,candidate_ms,checksum");
  for (int sample = 0; sample < samples; ++sample) {
    /* Change input outside timing and alternate order to reduce order bias. */
    x[0] = (double)sample;
    double a, b, ta, tb, start;
    if (sample % 2 == 0) {
      start = now_ms(); a = serial_sum(x, n); ta = now_ms() - start;
      start = now_ms(); b = two_sums(x, n); tb = now_ms() - start;
    } else {
      start = now_ms(); b = two_sums(x, n); tb = now_ms() - start;
      start = now_ms(); a = serial_sum(x, n); ta = now_ms() - start;
    }
    if (a != reference + sample || b != a) { puts("FAIL checksum"); RELEASE(x); return 1; }
    printf("%d,%.9f,%.9f,%.0f\\n", sample, ta, tb, b);
  }
  RELEASE(x);
  puts("PASS all samples; discard warm-up and report the distribution");
  return 0;
}
`,
  locality: `NOINLINE double walk(const double *a, int n, int column) {
  double s = 0.0;
  for (int outer = 0; outer < n; ++outer)
    for (int inner = 0; inner < n; ++inner)
      s += a[column ? inner * n + outer : outer * n + inner];
  return s;
}
int main(int argc, char **argv) {
  const int n = argument(argc, argv, 1, 512, 2048);
  const int samples = argument(argc, argv, 2, 7, 100);
  BUFFER(double, a, n * n);
  for (int i = 0; i < n * n; ++i) a[i] = (double)(i % 13);
  const double reference = walk(a, n, 0);
  puts("sample,row_ms,column_ms,checksum");
  for (int s = 0; s < samples; ++s) {
    a[0] = (double)s;
    double start = now_ms(), row = walk(a, n, 0);
    double row_ms = now_ms() - start;
    start = now_ms(); double column = walk(a, n, 1);
    double column_ms = now_ms() - start;
    if (row != reference + s || column != row) { puts("FAIL traversal"); RELEASE(a); return 1; }
    printf("%d,%.9f,%.9f,%.0f\\n", s, row_ms, column_ms, column);
  }
  RELEASE(a); puts("PASS every traversal"); return 0;
}
`,
  blocking: `NOINLINE void naive(const double *a, const double *b, double *c, int n) {
  for (int i = 0; i < n; ++i) for (int j = 0; j < n; ++j) {
    double s = 0;
    for (int k = 0; k < n; ++k) s += a[i*n+k] * b[k*n+j];
    c[i*n+j] = s;
  }
}
NOINLINE void tiled(const double *a, const double *b, double *c, int n, int tile) {
  for (int i = 0; i < n*n; ++i) c[i] = 0;
  for (int ii = 0; ii < n; ii += tile)
    for (int kk = 0; kk < n; kk += tile)
      for (int jj = 0; jj < n; jj += tile)
        for (int i = ii; i < n && i < ii+tile; ++i)
          for (int k = kk; k < n && k < kk+tile; ++k)
            for (int j = jj; j < n && j < jj+tile; ++j)
              c[i*n+j] += a[i*n+k] * b[k*n+j];
}
int main(int argc, char **argv) {
  const int n = argument(argc, argv, 1, 33, 512);
  const int tile = argument(argc, argv, 2, 8, 128);
  BUFFER(double, a, n*n); BUFFER(double, b, n*n);
  BUFFER(double, ref, n*n); BUFFER(double, out, n*n);
  for (int i = 0; i < n*n; ++i) { a[i] = i%7-3; b[i] = i%5-2; }
  double start = now_ms(); naive(a,b,ref,n); double baseline_ms = now_ms()-start;
  start = now_ms(); tiled(a,b,out,n,tile); double tiled_ms = now_ms()-start;
  double error = 0;
  for (int i = 0; i < n*n; ++i) error = !isfinite(out[i]) ? INFINITY : fmax(error, fabs(ref[i]-out[i]));
  printf("baseline_ms=%.9f tiled_ms=%.9f max_error=%.9g FLOPs=%.0f\\n",
         baseline_ms, tiled_ms, error, 2.0*n*n*n);
  RELEASE(a); RELEASE(b); RELEASE(ref); RELEASE(out);
  if (error != 0) { puts("FAIL edge tile or matrix output"); return 1; }
  puts("PASS all matrix entries; repeat timings before drawing conclusions"); return 0;
}
`,
  simd: `/* Independent iterations allow the compiler to consider vectorization.
   Do not add restrict/aligned promises unless their preconditions are true. */
NOINLINE void axpy(const double *x, const double *y, double *out, int n) {
  for (int i = 0; i < n; ++i) out[i] = 2.0*x[i] + y[i];
}
int main(int argc, char **argv) {
  const int n = argument(argc, argv, 1, 19, 10000000);
  BUFFER(double, x, n); BUFFER(double, y, n); BUFFER(double, out, n);
  for (int i = 0; i < n; ++i) { x[i] = i+1; y[i] = 3; }
  axpy(x,y,out,n);
  int failed = 0;
  for (int i = 0; i < n; ++i) if (out[i] != 2.0*(i+1)+3.0) failed++;
  printf("n=%d incorrect=%d last=%.0f\\n", n, failed, out[n-1]);
  RELEASE(x); RELEASE(y); RELEASE(out);
  if (failed) { puts("FAIL vector output"); return 1; }
  puts("PASS all outputs; inspect the compiler vectorization report"); return 0;
}
`,
  reduction: `#include <omp.h>
int main(int argc, char **argv) {
  const int n = argument(argc, argv, 1, 100003, 10000000);
  long long reduced = 0, atomic_sum = 0;
  /* default(none) forces us to state the sharing intent. Loop index is private. */
  #pragma omp parallel for default(none) shared(n) reduction(+:reduced)
  for (int i = 0; i < n; ++i) reduced += i+1;
  #pragma omp parallel for default(none) shared(n, atomic_sum)
  for (int i = 0; i < n; ++i) {
    #pragma omp atomic update
    atomic_sum += i+1;
  }
  const long long expected = (long long)n*(n+1)/2;
  printf("max_threads=%d reduction=%lld atomic=%lld reference=%lld\\n",
         omp_get_max_threads(), reduced, atomic_sum, expected);
  if (reduced != expected || atomic_sum != expected) { puts("FAIL reduction"); return 1; }
  puts("PASS both synchronized versions"); return 0;
}
`,
  scheduling: `#include <omp.h>
NOINLINE double task(int index, int n) {
  const int work = index < (n*3)/4 ? 100 : 5000;
  double value = 0.5;
  for (int k = 0; k < work; ++k) value = sqrt(value + 1.0);
  return value;
}
int main(int argc, char **argv) {
  const int n = argument(argc, argv, 1, 257, 10000);
  BUFFER(double, reference, n); BUFFER(double, output, n);
  BUFFER(int, owners, n);
  for (int i = 0; i < n; ++i) reference[i] = task(i,n);
  const double start = omp_get_wtime();
  /* Select static, static,1 or dynamic,1 with OMP_SCHEDULE. */
  #pragma omp parallel for default(none) shared(n, output, owners) schedule(runtime)
  for (int i = 0; i < n; ++i) {
    output[i] = task(i,n); owners[i] = omp_get_thread_num();
  }
  const double elapsed = omp_get_wtime()-start;
  int failed = 0;
  for (int i = 0; i < n; ++i) if (output[i] != reference[i]) failed++;
  printf("parallel_ms=%.9f incorrect=%d\\n", elapsed*1000.0, failed);
  for (int w = 0; w < omp_get_max_threads(); ++w) {
    int count = 0;
    for (int i = 0; i < n; ++i) if (owners[i] == w) count++;
    printf("worker=%d tasks=%d\\n", w, count);
  }
  RELEASE(reference); RELEASE(output); RELEASE(owners);
  if (failed) { puts("FAIL task output"); return 1; }
  puts("PASS all task outputs"); return 0;
}
`,
  scaling: `#include <omp.h>
int main(int argc, char **argv) {
  const int n = argument(argc, argv, 1, 1000000, 10000000);
  const int repeats = argument(argc, argv, 2, 7, 100);
  BUFFER(double, x, n); BUFFER(double, y, n); BUFFER(double, out, n);
  for (int i = 0; i < n; ++i) { x[i] = i%31; y[i] = i%7; }
  puts("sample,kernel_ms,GFLOP_s,logical_GB_s");
  for (int r = 0; r < repeats; ++r) {
    x[0] = r;
    double start = omp_get_wtime();
    #pragma omp parallel for default(none) shared(n,x,y,out)
    for (int i = 0; i < n; ++i) out[i] = 2*x[i]+y[i];
    double seconds = omp_get_wtime()-start;
    for (int i = 0; i < n; ++i) if (out[i] != 2*x[i]+y[i]) { puts("FAIL AXPY"); return 1; }
    if (seconds <= 0) { printf("%d,below-resolution,NA,NA\\n", r); continue; }
    /* 24 logical bytes: two double loads and one store, not measured DRAM traffic. */
    printf("%d,%.9f,%.9f,%.9f\\n",r,seconds*1000,2.0*n/seconds/1e9,24.0*n/seconds/1e9);
  }
  RELEASE(x); RELEASE(y); RELEASE(out);
  puts("PASS all samples; compare identical N across thread counts"); return 0;
}
`,
  mpi: `#include <mpi.h>
int main(int argc, char **argv) {
  MPI_Init(&argc, &argv);
  int rank, ranks;
  MPI_Comm_rank(MPI_COMM_WORLD, &rank); MPI_Comm_size(MPI_COMM_WORLD, &ranks);
  const int n = argument(argc, argv, 1, 17, 1000000);
  BUFFER(int, counts, ranks); BUFFER(int, displacements, ranks);
  for (int r = 0; r < ranks; ++r) {
    counts[r] = n/ranks + (r < n%ranks);
    displacements[r] = r*(n/ranks) + (r < n%ranks ? r : n%ranks);
  }
  /* At least one allocation slot even for zero-count ranks. */
  BUFFER(double, global, rank == 0 ? n : 1);
  BUFFER(double, local, counts[rank] ? counts[rank] : 1);
  if (rank == 0) for (int i = 0; i < n; ++i) global[i] = i+1;
  MPI_Barrier(MPI_COMM_WORLD);
  double start = MPI_Wtime();
  MPI_Scatterv(global, counts, displacements, MPI_DOUBLE,
               local, counts[rank], MPI_DOUBLE, 0, MPI_COMM_WORLD);
  double partial = 0, total = 0;
  for (int i = 0; i < counts[rank]; ++i) partial += local[i];
  MPI_Reduce(&partial, &total, 1, MPI_DOUBLE, MPI_SUM, 0, MPI_COMM_WORLD);
  double elapsed = MPI_Wtime()-start, maximum = 0;
  MPI_Reduce(&elapsed, &maximum, 1, MPI_DOUBLE, MPI_MAX, 0, MPI_COMM_WORLD);
  int failed = 0;
  if (rank == 0) {
    failed = total != (double)n*(n+1)/2;
    printf("ranks=%d n=%d total=%.0f max_rank_ms=%.9f\\n", ranks,n,total,maximum*1000);
    puts(failed ? "FAIL distributed sum" : "PASS uneven and zero-count partitions");
  }
  MPI_Bcast(&failed,1,MPI_INT,0,MPI_COMM_WORLD);
  RELEASE(counts); RELEASE(displacements); RELEASE(global); RELEASE(local);
  MPI_Finalize(); return failed;
}
`,
  stencil: `#include <mpi.h>
int main(int argc, char **argv) {
  MPI_Init(&argc, &argv);
  int rank, ranks; MPI_Comm_rank(MPI_COMM_WORLD,&rank); MPI_Comm_size(MPI_COMM_WORLD,&ranks);
  const int n = argument(argc,argv,1,17,1000000), steps = argument(argc,argv,2,10,1000);
  /* This native stencil deliberately requires at least one interior cell per rank. */
  if (ranks > n) { if (rank == 0) puts("Use ranks <= interior cells"); MPI_Finalize(); return 2; }
  BUFFER(int, counts, ranks); BUFFER(int, displacements, ranks);
  for (int r = 0; r < ranks; ++r) {
    counts[r] = n/ranks + (r < n%ranks);
    displacements[r] = r*(n/ranks) + (r < n%ranks ? r : n%ranks);
  }
  const int count = counts[rank];
  BUFFER(double, a, count+2); BUFFER(double, b, count+2); BUFFER(double, collected, n);
  BUFFER(double, reference, n+2); BUFFER(double, next, n+2);
  if (rank == 0) a[0] = b[0] = 100;
  reference[0] = next[0] = 100;
  const int left = rank ? rank-1 : MPI_PROC_NULL;
  const int right = rank+1 < ranks ? rank+1 : MPI_PROC_NULL;
  MPI_Barrier(MPI_COMM_WORLD); double start = MPI_Wtime();
  for (int s = 0; s < steps; ++s) {
    /* Send left interior / receive right halo, then the opposite direction.
       Sendrecv avoids depending on eager buffering of blocking sends. */
    MPI_Sendrecv(a+1,1,MPI_DOUBLE,left,10,a+count+1,1,MPI_DOUBLE,right,10,MPI_COMM_WORLD,MPI_STATUS_IGNORE);
    MPI_Sendrecv(a+count,1,MPI_DOUBLE,right,20,a,1,MPI_DOUBLE,left,20,MPI_COMM_WORLD,MPI_STATUS_IGNORE);
    for (int i = 1; i <= count; ++i) b[i] = (a[i-1]+a[i]+a[i+1])/3.0;
    for (int i = 1; i <= count; ++i) a[i] = b[i];
  }
  double elapsed = MPI_Wtime()-start, maximum = 0;
  MPI_Reduce(&elapsed,&maximum,1,MPI_DOUBLE,MPI_MAX,0,MPI_COMM_WORLD);
  MPI_Gatherv(a+1,count,MPI_DOUBLE,collected,counts,displacements,MPI_DOUBLE,0,MPI_COMM_WORLD);
  int failed = 0;
  if (rank == 0) {
    for (int s = 0; s < steps; ++s) {
      for (int i = 1; i <= n; ++i) next[i] = (reference[i-1]+reference[i]+reference[i+1])/3.0;
      for (int i = 1; i <= n; ++i) reference[i] = next[i];
    }
    double error = 0;
    for (int i = 0; i < n; ++i) error = !isfinite(collected[i]) ? INFINITY : fmax(error,fabs(collected[i]-reference[i+1]));
    failed = error > 1e-12;
    printf("n=%d steps=%d max_error=%.9g max_rank_ms=%.9f\\n",n,steps,error,maximum*1000);
    puts(failed ? "FAIL stencil" : "PASS all cells after halo exchange");
  }
  MPI_Bcast(&failed,1,MPI_INT,0,MPI_COMM_WORLD);
  RELEASE(counts); RELEASE(displacements); RELEASE(a); RELEASE(b);
  RELEASE(collected); RELEASE(reference); RELEASE(next);
  MPI_Finalize(); return failed;
}
`,
}

const timingLabs = new Set(['benchmark', 'locality', 'blocking'])
export const OPENMP_LABS = ['reduction', 'scheduling', 'scaling']
export const MPI_LABS = ['mpi', 'stencil']

export function exampleCode(lab, language = 'cpp') {
  if (!Object.hasOwn(bodies, lab) || !['c', 'cpp'].includes(language)) throw new Error('Unknown native HPC example.')
  const cpp = language === 'cpp'
  const headers = `/* VoltQuest: ${lab}. ${cpp ? 'C++17' : 'C17'} native companion.\n   Run on your own computer with the build commands beside the editor.\n   Browser controls do not compile or execute this source. */\n${cpp ? '#include <vector>\n#include <chrono>\n' : '#define _POSIX_C_SOURCE 200809L\n#include <time.h>\n'}#include <stdio.h>\n#include <stdlib.h>\n#include <errno.h>\n#include <math.h>\n\n`
  const allocation = cpp ? `// RAII: vector storage is released automatically at scope exit.
#define BUFFER(type, name, count) std::vector<type> name##_storage((size_t)(count), 0); type *name = name##_storage.data()
#define RELEASE(name) ((void)0)
` : `// Each C allocation has an explicit matching RELEASE on normal exit.
#define BUFFER(type, name, count) type *name = (type *)calloc((size_t)(count), sizeof(type)); if (!name) { fputs("Allocation failed\\n", stderr); abort(); }
#define RELEASE(name) free(name)
`
  const timer = !timingLabs.has(lab) ? '' : cpp ? `static double now_ms(void) {
  return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now().time_since_epoch()).count();
}
` : `static double now_ms(void) {
  struct timespec t;
  if (clock_gettime(CLOCK_MONOTONIC, &t) != 0) { perror("clock_gettime"); exit(2); }
  return (double)t.tv_sec*1000.0 + (double)t.tv_nsec/1000000.0;
}
`
  return headers + allocation + `
#if defined(__GNUC__) || defined(__clang__)
#define NOINLINE __attribute__((noinline))
#else
#define NOINLINE
#endif
static int argument(int argc, char **argv, int index, int fallback, int maximum) {
  if (index >= argc) return fallback;
  char *end = NULL; errno = 0;
  long value = strtol(argv[index], &end, 10);
  if (errno || end == argv[index] || *end || value < 1 || value > maximum) {
    fprintf(stderr, "Argument %d must be an integer in [1,%d]\\n",index,maximum); exit(2);
  }
  return (int)value;
}
` + timer + '\n' + bodies[lab]
}

export function nativeInstructions(lab, language = 'cpp') {
  const cpp = language === 'cpp', file = `${lab}.${cpp ? 'cpp' : 'c'}`
  const compiler = MPI_LABS.includes(lab) ? (cpp ? 'mpicxx' : 'mpicc') : cpp ? 'c++' : 'cc'
  const flags = OPENMP_LABS.includes(lab) ? ' -fopenmp' : ''
  const build = `${compiler} -std=${cpp ? 'c++17' : 'c17'} -O3 -Wall -Wextra${flags} ${file} -lm -o ${lab}`
  const macBuild = OPENMP_LABS.includes(lab) ? `${cpp ? 'clang++' : 'clang'} -std=${cpp ? 'c++17' : 'c17'} -O3 -Wall -Wextra -Xpreprocessor -fopenmp -I"$(brew --prefix libomp)/include" -L"$(brew --prefix libomp)/lib" ${file} -lomp -o ${lab}` : null
  const run = MPI_LABS.includes(lab) ? `mpiexec -n 4 ./${lab} 17${lab === 'stencil' ? ' 10' : ''}` : OPENMP_LABS.includes(lab) ? `OMP_NUM_THREADS=4 OMP_SCHEDULE=dynamic,1 ./${lab}` : `./${lab}`
  return { file, build, macBuild, run, requirements: MPI_LABS.includes(lab) ? 'Requires a local MPI implementation and its C/C++ compiler wrappers.' : OPENMP_LABS.includes(lab) ? 'Requires an OpenMP-enabled compiler and runtime. GCC supports -fopenmp; Apple Clang needs a separately installed runtime and explicit include/link flags.' : 'Requires a C17 or C++17 compiler. The C timing examples use a POSIX monotonic clock (Linux, macOS or WSL).' }
}
