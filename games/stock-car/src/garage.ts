import { renderCar } from './showroom'
import { renderDriver } from './driver'

export function setupGarage() {
  const dialog = document.querySelector<HTMLDialogElement>('#garage')!
  const form = document.querySelector<HTMLFormElement>('#garage-form')!
  const portrait = document.querySelector<HTMLCanvasElement>('#portrait')!
  const icon = document.querySelector<HTMLCanvasElement>('#driver-icon')!
  const car = { paint: '#ff5c25', number: '27' }

  function control(name: string) {
    return form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement
  }

  const options = document.getElementById('driver-options')!
  function addPicker(name: string, label: string, choices: string[], color = false) {
    const row = document.createElement('div')
    row.className = 'driver-picker'
    const title = document.createElement('small')
    title.textContent = label
    const input = document.createElement('input')
    input.name = name
    input.type = color ? 'color' : 'hidden'
    input.value = choices[0]
    input.setAttribute('aria-label', label)
    const display = document.createElement('output')
    display.setAttribute('aria-label', label)
    const refresh = () => { display.value = input.value }
    function arrow(step: number) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = step < 0 ? '‹' : '›'
      button.setAttribute('aria-label', (step < 0 ? 'Previous ' : 'Next ') + label.toLowerCase())
      button.onclick = () => {
        const index = choices.indexOf(input.value)
        const next = index < 0 ? (step < 0 ? choices.length - 1 : 0) : (index + step + choices.length) % choices.length
        input.value = choices[next]
        refresh()
        preview()
      }
      return button
    }
    row.append(title, arrow(-1), input)
    if (!color) row.append(display)
    row.append(arrow(1))
    options.append(row)
    refresh()
    return refresh
  }
  const refreshPickers = [
    addPicker('style', 'Hairstyle', ['Crew cut', 'Side part', 'Curls', 'Mullet', 'Bald']),
    addPicker('facial', 'Facial hair', ['Clean-shaven', 'Mustache', 'Goatee', 'Full beard']),
    addPicker('hair', 'Hair color', ['#482e25', '#241d1b', '#976546', '#d9b36a', '#aa5030', '#aaa7a0'], true),
    addPicker('skin', 'Skin tone', ['#c98f68', '#a97050', '#855438', '#603c2b', '#e1ac87', '#f1c6a6'], true)
  ]
  const names = ['paint', 'number', 'style', 'facial', 'hair', 'skin']
  let applied = names.map(name => control(name).value)

  const carPreview = document.querySelector<HTMLCanvasElement>('#car-preview')!
  let values = applied
  let frame = 0
  let opened = 0
  function animate(now: number) {
    if (!dialog.open) return
    const angle = (now - opened) * .00055
    renderCar(carPreview, .86 + angle, values[0], values[1])
    renderDriver(portrait, .28 + angle, values, false, (now - opened) / 1000)
    frame = requestAnimationFrame(animate)
  }
  function preview() {
    values = names.map(name => control(name).value)
    document.getElementById('preview-number')!.textContent = '#' + values[1]
  }
  function apply() {
    applied = names.map(name => control(name).value)
    car.paint = applied[0]
    car.number = applied[1]
    document.getElementById('driver-number')!.textContent = car.number
    renderDriver(icon, .26, applied, true)
  }

  document.getElementById('garage-open')!.onclick = () => {
    names.forEach((name, i) => { control(name).value = applied[i] })
    refreshPickers.forEach(refresh => refresh())
    preview()
    dialog.showModal()
    opened = performance.now()
    animate(opened)
  }
  document.getElementById('garage-cancel')!.onclick = () => dialog.close()
  dialog.onclose = () => cancelAnimationFrame(frame)
  form.oninput = preview
  form.onsubmit = () => { preview(); apply() }
  preview()
  apply()
  return { dialog, car }
}
