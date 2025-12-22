let w = window.innerWidth
let h = window.innerHeight
let list = document.getElementById('list')

const drawClone = (p) => {
  let listClone = list.cloneNode(true)
  listClone.removeAttribute('id');
  listClone.classList.add('list-clone')
  listClone.style.top = p[0] + 'px'
  listClone.style.left = p[1] + 'px'
  document.body.appendChild(listClone)
}

let points = Array.from({length: 4 + Math.floor(Math.random() * 2)}, () => [Math.random()*h, Math.random()*w])
let spline = new BSpline(points, 3)
let t = 0
let interval = setInterval(() => {
  var p = spline.calcAt(t) 
  drawClone(p)
  t += 0.01
  if (t >= 1) clearInterval(interval)
}, 25)
