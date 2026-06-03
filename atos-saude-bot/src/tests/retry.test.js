import { describe, it, expect, vi } from 'vitest'
import { withRetry } from '../utils/retry.js'

describe('withRetry', () => {
  it('retorna o resultado da função na primeira tentativa', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, { attempts: 3, baseDelayMs: 0 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('tenta novamente após falha e retorna na segunda tentativa', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValue('sucesso')
    const result = await withRetry(fn, { attempts: 3, baseDelayMs: 0 })
    expect(result).toBe('sucesso')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('lança o último erro após esgotar todas as tentativas', async () => {
    const err = new Error('sempre falha')
    const fn = vi.fn().mockRejectedValue(err)
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 0 })).rejects.toThrow('sempre falha')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('usa defaults: 3 tentativas', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('x'))
    await expect(withRetry(fn, { baseDelayMs: 0 })).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('tenta apenas 1 vez quando attempts=1', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    await expect(withRetry(fn, { attempts: 1, baseDelayMs: 0 })).rejects.toThrow('fail')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retorna valor de função síncrona (await transparente)', async () => {
    const fn = vi.fn().mockResolvedValue(42)
    expect(await withRetry(fn, { attempts: 1, baseDelayMs: 0 })).toBe(42)
  })
})
