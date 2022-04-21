
test('hello jest', () => {
  expect(['Hello', 'world!'].join(' ')).toBe('Hello world!')
})

test('jest dom 101', done => {
  expect(document).toBeTruthy()
  const $el = document.createElement('div')
  $el.id = 'hello'
  $el.innerHTML = 'Hello jest!'
  document.body.appendChild($el)
  expect(document.body.innerHTML).toBe('<div id="hello">Hello jest!</div>')
  document.getElementById('hello').style.width = '100px'
  setTimeout(() => {
    done()
  }, 500)
})
