import { readFileSync } from 'node:fs'
import { replayCalculation } from '../src/utils/calculationReplay.js'

if (!process.argv[2]) throw new Error('Uso: node scripts/replay-calculation.mjs ARCHIVO_CALCULO.json')
const snapshot = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const result = replayCalculation(snapshot)
console.log(JSON.stringify(result, null, 2))
if (result.status !== 'reproduced') process.exitCode = 1
