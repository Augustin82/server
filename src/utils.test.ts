import { isUUID } from './utils'

describe('Utils', () => {
  describe('isUUID', () => {
    it('Correctly identifies v4 uuid as a valid uuid', () => {
      const result = isUUID('2f85d9fc-6073-42d0-a0f3-53cf989542d7')

      expect(result).toBe(true)
    })

    it('Correctly rejects a non v4 uuid value', () => {
      const result = isUUID('2f85d-6073-42d0-a0f3')
      expect(result).toBe(false)
    })
  })
})
