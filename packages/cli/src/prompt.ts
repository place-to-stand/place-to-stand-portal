import { createInterface } from 'node:readline/promises'

// Spelled with char codes rather than literals: these are invisible control
// characters, and an editor or a copy-paste would silently eat them.
const ENTER = ['\n', '\r']
const END_OF_TRANSMISSION = String.fromCharCode(4) // Ctrl-D
const INTERRUPT = String.fromCharCode(3) // Ctrl-C
const BACKSPACE = [String.fromCharCode(127), '\b']

const NO_INPUT =
  'No input available on stdin. Pass --email and set PTS_PASSWORD to sign in non-interactively.'

export async function promptLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr })

  try {
    // `rl.question` never settles if stdin reaches EOF first, which would hang
    // until the event loop drained and leave Node complaining about an
    // unsettled await instead of saying what went wrong. Race the close event.
    const answer = await new Promise<string>((resolve, reject) => {
      rl.once('close', () => reject(new Error(NO_INPUT)))
      rl.question(question).then(resolve, reject)
    })

    return answer.trim()
  } finally {
    rl.close()
  }
}

/**
 * Read a secret without echoing it. Raw mode is the only way to keep the
 * characters off the screen; without a TTY (a piped password, or CI) fall back
 * to a plain line read, where there is no terminal echo to suppress.
 */
export function promptHidden(question: string): Promise<string> {
  const { stdin } = process

  if (!stdin.isTTY) {
    return promptLine(question)
  }

  return new Promise<string>((resolve, reject) => {
    process.stderr.write(question)

    let value = ''

    const finish = (handler: () => void) => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.off('data', onData)
      process.stderr.write('\n')
      handler()
    }

    const onData = (chunk: string) => {
      // Raw mode can deliver several keystrokes in one chunk.
      for (const char of chunk) {
        if (ENTER.includes(char) || char === END_OF_TRANSMISSION) {
          finish(() => resolve(value))
          return
        }

        if (char === INTERRUPT) {
          finish(() => reject(new Error('Cancelled.')))
          return
        }

        if (BACKSPACE.includes(char)) {
          value = value.slice(0, -1)
        } else {
          value += char
        }
      }
    }

    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    stdin.on('data', onData)
  })
}
