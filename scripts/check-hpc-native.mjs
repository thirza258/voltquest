#!/usr/bin/env node
/** Compile and execute the exact downloadable examples. No learner code is run by the app. */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { exampleCode, OPENMP_LABS, MPI_LABS } from '../frontend/src/features/hpc/examples.js'

const directory = mkdtempSync(join(tmpdir(), 'voltquest-hpc-'))
const full = process.argv.includes('--parallel')
const sanitize = process.argv.includes('--sanitize')
const labs = ['correctness', 'benchmark', 'locality', 'blocking', 'simd', ...(full ? [...OPENMP_LABS, ...MPI_LABS] : [])]
const cases = {
  correctness: [[1], [1000], [1001]], benchmark: [[1, 3], [19, 3], [100003, 4]],
  locality: [[1, 3], [17, 3], [128, 3]], blocking: [[1, 1], [17, 8], [33, 7], [7, 32]],
  simd: [[1], [15], [16], [17], [19]], reduction: [[1], [17], [100003]],
  scheduling: [[1], [17], [257]], scaling: [[17, 3], [100003, 3]], mpi: [[1], [17], [10003]],
  stencil: [[17, 1], [17, 10], [19, 25]],
}
let runs = 0, builds = 0
function execute(command, args, env = {}) {
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', timeout: 60000, env: { ...process.env, ...env } })
  if (result.error || result.status !== 0) throw new Error(`${command} ${args.join(' ')}\n${result.error ?? ''}\n${result.stdout}\n${result.stderr}`)
  return result.stdout
}
try {
  for (const language of ['c', 'cpp']) for (const lab of labs) {
    const mpi = MPI_LABS.includes(lab), omp = OPENMP_LABS.includes(lab)
    const source = `${lab}.${language}`, executable = join(directory, `${lab}-${language}`)
    writeFileSync(join(directory, source), exampleCode(lab, language))
    const compiler = mpi ? (language === 'c' ? 'mpicc' : 'mpicxx') : language === 'c' ? (process.env.HPC_CC ?? 'cc') : (process.env.HPC_CXX ?? 'c++')
    const ompFlags = !omp ? [] : process.env.HPC_OMP_PREFIX ? ['-Xpreprocessor', '-fopenmp', `-I${process.env.HPC_OMP_PREFIX}/include`, `-L${process.env.HPC_OMP_PREFIX}/lib`, '-lomp'] : ['-fopenmp']
    execute(compiler, [`-std=${language === 'c' ? 'c17' : 'c++17'}`, sanitize ? '-O1' : '-O3', '-Wall', '-Wextra', '-Werror', ...(sanitize ? ['-fsanitize=address,undefined', '-fno-omit-frame-pointer'] : []), ...ompFlags, source, '-lm', '-o', executable])
    builds++
    for (const args of cases[lab]) for (const workers of (mpi || omp ? [1, 2, 4] : [1])) {
      const output = execute(mpi ? 'mpiexec' : executable, mpi ? ['-n', String(workers), executable, ...args.map(String)] : args.map(String), { OMP_NUM_THREADS: String(workers), OMP_SCHEDULE: 'dynamic,1' })
      if (!output.includes('PASS')) throw new Error(`${lab} did not pass: ${output}`)
      runs++
    }
    if (lab === 'scheduling') for (const schedule of ['static', 'static,1', 'dynamic,4']) {
      if (!execute(executable, ['257'], { OMP_NUM_THREADS: '4', OMP_SCHEDULE: schedule }).includes('PASS')) throw new Error('Schedule check failed')
      runs++
    }
    console.log(`PASS ${source}`)
  }
  console.log(`${builds} native builds, ${runs} behavioral runs passed${sanitize ? ' with ASan/UBSan' : ''}.`)
  if (!full) console.log('OpenMP/MPI checks require --parallel and installed compiler runtimes.')
} finally { rmSync(directory, { recursive: true, force: true }) }
