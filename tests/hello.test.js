test('hello jest', () => {
  expect(['Hello', 'world!'].join(' ')).toBe('Hello world!')
})

test('jest dom 101', () => {
  expect(document).toBeTruthy()
})
