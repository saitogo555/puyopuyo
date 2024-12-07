/**
 * @class
 */
class Puyo {
  /**
   * @param {number} x 
   * @param {number} y 
   * @param {string} color
   */
  constructor(x, y, color) {
    /**
     * ぷよを描画するX座標
     * @type {number}
     */
    this.x = x

    /**
     * ぷよを描画するY座標
     * @type {number}
     */
    this.y = y

    /**
     * ぷよの色
     * @type {string}
     */
    this.color = color

    /**
     * 描画の拡大率
     * @type {number}
     */
    this.scale = 1
  } 
}


/**
 * キャンバス
 * @type {HTMLCanvasElement}
 */
const canvas = document.getElementById("canvas")
canvas.width = 1000
canvas.height = 1000

/**
 * 2Dコンテキスト
 * @type {CanvasRenderingContext2D}
 */
const ctx = canvas.getContext("2d")

/**
 * フレームレート
 * @type {number}
 */
const fps = 60

/**
 * ぷよの落下速度
 * @type {number}
 */
let speed = 1

/**
 * 画面の最終更新時間
 * @type {number}
 */
let lastUpdateTime = 0

/**
 * 入力可能フラグ
 * @type {boolean}
 */
let isAllowInput = true

/**
 * 落下アニメーション用のカウンター
 * @type {number}
 */
let fallCount = 0

/**
 * 削除アニメーション用のカウンター
 * @type {number}
 */
let eraseCount = 0

/**
 * 削除するぷよの座標リスト
 * @type {Array<{ x: number, y: number}>}
 */
const erasePosList = []

/**
 * フィールド
 * @type {Array<Array<Puyo>>}
 */
const field = []

/**
 * フィールドの横幅
 * @type {number}
 */
const fieldWidth = 6

/**
 * フィールドの縦幅
 * @type {number}
 */
const fieldHeight = 13


/**
 * ぷよの横幅
 * @type {number}
 */
const puyoWidth = Math.max(canvas.width, canvas.height) / Math.max(fieldWidth, fieldHeight - 1)

/**
 * ぷよの縦幅
 * @type {number}
 */
const puyoHeight = puyoWidth

/**
 * 落下中のぷよ
 * @type {Array<Puyo>}
 */
const fallingPuyo = []

/**
 * ネクストのぷよ
 * @type {Array<Array<Puyo>>}
 */
const nextPuyo = []

/**
 * 軸ぷよの座標
 * @type {{ x: number, y: number}}
 */
const puyoPos = { x: 1, y: 0 }

/**
 * ぷよのカラーリスト
 * @type {Array<string>}
 */
const colorList = [
  "red",
  "green",
  "blue",
  "yellow",
  "purple"
]

/**
 * ぷよの画像リスト
 * @type {Array<HTMLImageElement>}
 */
const imageList = []

/**
 * 初期化
 */
function init() {
  field.length = 0
  for (let y = 0; y < fieldHeight; y++) {
    field[y] = []
    for (let x = 0; x < fieldWidth; x++) {
      field[y][x] = null
    }
  } 

  colorList.forEach(color => {
    const img = new Image()
    img.src = "./images/" + color + "_puyo.png"
    imageList.push(img)
  })
}

/**
 * ぷよを生成
 * @returns {Puyo}
 */
function generate() {
  return new Puyo(0, 0, colorList[Math.floor(Math.random() * colorList.length)])
}

/**
 * 組ぷよを取得
 * @returns {Array<Puyo>}
 */
function next() {
  // 2つ1組のぷよを3つ生成する
  while (nextPuyo.length < 3) {
    nextPuyo.push([...Array(2)].map(i => generate()))
  }
  return nextPuyo.shift()
}

/**
 * 組ぷよをスポーンする
 * @returns {void}
 */
function spawn() {
  // 落下中のぷよデータを空にする
  fallingPuyo.length = 0

  // ネクストから2つ1組のぷよデータを取得
  const pairPuyo = next()

  // 各ぷよの軸ぷよに対しての相対座標を更新
  pairPuyo.forEach((puyo, index) => {
    puyo.y = -index
    fallingPuyo.push(puyo)
  })

  // 軸ぷよのXY座標を更新
  puyoPos.x = 2
  puyoPos.y = 0.5
}

/**
 * ぷよを固定する
 * @returns {void}
 */
function fix() {
  puyoPos.y = Math.ceil(puyoPos.y)
  for (const puyo of fallingPuyo) {
    puyo.x += puyoPos.x
    puyo.y += puyoPos.y
    field[puyo.y][puyo.x] = puyo
  }
}

/**
 * ぷよを落下させる
 * @returns {void}
 */
function fall() {
  for (let y = fieldHeight - 2; y >= 0; y--) {
    for (let x = fieldWidth - 1; x >= 0; x--) {
      const puyo = field[y][x]
      if (!puyo) {
        continue
      }

      let tempY = y
      while (isMovable(x, tempY + 1)) {
        field[tempY][x] = null
        tempY++
        field[tempY][x] = puyo
      }
    }
  }
}

/**
 * 削除可能な4つ以上繋がったぷよのXY座標リストを返す
 * @returns {Array<{ x: number, y: number }>}
 */
function findErasablePos() {
  // 4つ以上繋がった各ぷよのXY座標リスト
  /** @type {Array<{ x: number, y: number }>} */
  const posList = []

  // 検索済みのXY座標リスト
  /** @type {Array<{ x: number, y: number }>} */
  const exploredList = []

  /**
   * 深さ優先探索アルゴリズムで隣り合う同色のぷよを検索
   * @param {number} x
   * @param {number} y
   * @param {string} color
   * @returns {void}
   */
  const dfs = (x, y, color) => {
    if (!isWithinField(x, y)) {
      return
    } else if (!isExist(x, y)) {
      return
    } else if (field[y][x].color !== color) {
      return
    } else if (exploredList.some(item => JSON.stringify(item) === JSON.stringify({ x: x, y: y }))) {
      return
    }

    posList.push({ x: x, y: y })
    exploredList.push({ x: x, y: y })
    for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 2) {
      dfs(x + Math.round(Math.cos(angle)), y + Math.round(Math.sin(angle)), color)
    }
  }

  for (let y = 0; y < fieldHeight; y++) {
    for (let x = 0; x < fieldWidth; x++) {
      const puyo = field[y][x]
      if (!puyo) {
        continue
      }

      posList.length = 0
      exploredList.length = 0
      dfs(x, y, puyo.color)
      if (posList.length >= 4) {
        return posList
      }
    }
  }
  return []
}

/**
 * 左へ移動
 * @returns {void}
 */
function moveLeft() {
  // 全てのぷよが左移動後の座標に移動可能なのか判定
  if (fallingPuyo.some(puyo => !isMovable(puyoPos.x + puyo.x - 1, puyoPos.y + puyo.y))) {
    return
  }

  // 軸ぷよのX座標を更新
  puyoPos.x--
}

/**
 * 右へ移動
 * @returns {void}
 */
function moveRight() {
  // 全てのぷよが右移動後の座標に移動可能なのか判定
  if (fallingPuyo.some(puyo => !isMovable(puyoPos.x + puyo.x + 1, puyoPos.y + puyo.y))) {
    return
  }

  // 軸ぷよのX座標を更新
  puyoPos.x++
}

/**
 * 下へ移動
 * @returns {void}
 */
function moveDown() {
  // 全てのぷよが下移動後の座標に移動可能なのか判定
  if (fallingPuyo.some(puyo => !isMovable(puyoPos.x + puyo.x, puyoPos.y + puyo.y + 1))) {
    return
  }

  // 軸ぷよのY座標を更新
  puyoPos.y++
}

/**
 * 左回転
 * @returns {void}
 */
function rotateLeft() {
  // 軸ぷよのオフセットベクトル
  const offsetList = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ]
  for (const offset of offsetList) {
    // 回転処理のために落下中のぷよデータをコピー
    /** @type {Array<Puyo>} */
    const tempFallingPuyo = JSON.parse(JSON.stringify(fallingPuyo))

    // 軸ぷよは回転しないので除外(一時避難)
    const basePuyo = tempFallingPuyo.shift()
    tempFallingPuyo.map(puyo => {
      // 90度回転した角度を計算
      /**
       * atan2で子ぷよのXY座標から現在の角度を計算
       * 左回転方向に90度ずらす
       */
      const angle = Math.atan2(puyo.y, puyo.x) - (Math.PI / 2)
      puyo.x = Math.round(Math.cos(angle))
      puyo.y = Math.round(Math.sin(angle))
      return puyo
    })

    // 軸ぷよを元に戻す
    tempFallingPuyo.unshift(basePuyo)

    // 全てのぷよが回転後・オフセット後の座標に移動可能なのか判定
    if (tempFallingPuyo.some(puyo => !isMovable(puyoPos.x + puyo.x + offset.x, puyoPos.y + puyo.y + offset.y))) {
      continue
    }

    // 落下中のぷよデータを回転後のデータに置き換える
    fallingPuyo.length = 0
    for (const puyo of tempFallingPuyo) {
      fallingPuyo.push(puyo)
    }

    // 軸ぷよのXY座標を更新
    puyoPos.x += offset.x
    puyoPos.y += offset.y
    break
  }
}

/**
 * 右回転
 * @returns {void}
 */
function rotateRight() {
  const offsetList = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ]
  for (const offset of offsetList) {
    /** @type {Array<Puyo>} */
    const tempFallingPuyo = JSON.parse(JSON.stringify(fallingPuyo))
    const basePuyo = tempFallingPuyo.shift()
    tempFallingPuyo.map(puyo => {
      const angle = Math.atan2(puyo.y, puyo.x) + (Math.PI / 2)
      puyo.x = Math.round(Math.cos(angle))
      puyo.y = Math.round(Math.sin(angle))
      return puyo
    })
    tempFallingPuyo.unshift(basePuyo)
    if (tempFallingPuyo.some(puyo => !isMovable(puyoPos.x + puyo.x + offset.x, puyoPos.y + puyo.y + offset.y))) {
      continue
    }

    fallingPuyo.length = 0
    for (const puyo of tempFallingPuyo) {
      fallingPuyo.push(puyo)
    }
    puyoPos.x += offset.x
    puyoPos.y += offset.y
    break
  }
}

/**
 * 指定したXY座標がフィールド内であるか判定
 * @param {number} x 
 * @param {number} y 
 * @returns {boolean}
 */
function isWithinField(x, y) {
  // 落下中のY座標の小数を繰り上げる
  y = Math.ceil(y)
  return (0 <= x && x < fieldWidth) && (0 <= y && y < fieldHeight) 
}

/**
 * 指定したXY座標のフィールドにぷよが存在するか判定
 * @param {number} x 
 * @param {number} y 
 * @returns {boolean}
 */
function isExist(x, y) {
  // 落下中のY座標の小数を繰り上げる
  y = Math.ceil(y)
  return !!field[y][x]
}

/**
 * 指定したXY座標がフ移動可能であるか判定
 * @param {number} x 
 * @param {number} y 
 * @returns {boolean}
 */
function isMovable(x, y) {
  return isWithinField(x, y) && !isExist(x, y)
}

/**
 * ゲームオーバーなのか判定
 * @returns {boolean}
 */
function isGameover() {
  return !!field[1][2]
}

/**
 * 背景を描画
 * @returns {void}
 */
function drawBackground() {
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

/**
 * ステージを描画
 * @returns {void}
 */
function drawStage() {
  // 左右の余白
  const margin = (canvas.width - puyoWidth * fieldWidth) / 2

  // 線の太さ
  const lineWidth = 2

  ctx.lineWidth = lineWidth
  ctx.strokeStyle = "#666666"
  ctx.beginPath()
  ctx.moveTo(margin - lineWidth, 0)
  ctx.lineTo(margin - lineWidth, canvas.height)
  ctx.stroke()
  ctx.moveTo(canvas.width - margin + lineWidth, 0)
  ctx.lineTo(canvas.width - margin + lineWidth, canvas.height)
  ctx.stroke()
}

/**
 * ぷよを描画
 * @param {number} x
 * @param {number} y
 * @param {string} color
 * @param {number} scale
 * @returns {void}
 */
function drawPuyo(x, y, color, scale) {
  /*
  ctx.beginPath()
  ctx.arc(x, y, puyoWidth / 2 * scale, 0, 360 * 180 * Math.PI)
  ctx.fillStyle = color
  ctx.fill()
  */

  x = x - puyoWidth / 2 + puyoWidth * (1 - scale) / 2
  y = y - puyoHeight / 2 + puyoHeight * (1 - scale) / 2
  const img = imageList[colorList.indexOf(color)]
  ctx.drawImage(img, x, y, puyoWidth * scale, puyoHeight * scale)
}

/**
 * フィールドを描画
 * @returns {void}
 */
function drawField() {
  const margin = (canvas.width - puyoWidth * fieldWidth) / 2 
  for (let y = 1; y < fieldHeight; y++) {
    for (let x = 0; x < fieldWidth; x++) {
      const puyo = field[y][x]
      if (!puyo) {
        continue
      }

      const offsetY = puyoHeight
      const posX = puyoWidth / 2 + puyoWidth * puyo.x + margin
      const posY = puyoHeight / 2 + puyoHeight * puyo.y - offsetY
      drawPuyo(posX, posY, puyo.color, puyo.scale)
    }
  }
}

/**
 * 落下中のぷよを描画
 * @returns {void}
 */
function drawFallingPuyo() {
  const margin = (canvas.width - puyoWidth * fieldWidth) / 2
  for (const puyo of fallingPuyo) {
    if (!puyo) {
      continue
    }

    const offsetY = puyoHeight
    const posX = puyoWidth / 2 + puyoWidth * (puyoPos.x + puyo.x) + margin
    const posY = puyoHeight / 2 + puyoHeight * (puyoPos.y + puyo.y) - offsetY
    drawPuyo(posX, posY, puyo.color, puyo.scale)
  }
}

/**
 * ネクストのぷよを描画
 * @returns {void}
 */
function drawNextPuyo() {
  const margin = (canvas.width - puyoWidth * fieldWidth) / 2
  nextPuyo.forEach((np, n) => {
    const x = canvas.width - margin + puyoWidth / 2
    const y = puyoHeight / 2 + puyoHeight * 3.5 * n
    const w = puyoWidth * 2
    const h = puyoHeight * 3
    ctx.beginPath()
    ctx.strokeStyle = "#666666"
    ctx.lineWidth = 2
    ctx.rect(x, y, w, h)
    ctx.stroke()

    np.forEach((puyo, i) => {
      const posX = canvas.width - margin / 2
      const posY = puyoHeight * 2.5 - puyoHeight * i + puyoHeight * 3.5 * n
      drawPuyo(posX, posY, puyo.color, puyo.scale)
    })
  })
}

/**
 * ゲームオーバーゾーンを描画
 * @returns {void}
 */
function drawGameoverZone() {
  const margin = (canvas.width - puyoWidth * fieldWidth) / 2
  const x = puyoWidth * 2.5 + margin
  const y = puyoHeight / 2
  ctx.strokeStyle = "#d61717"
  ctx.lineWidth = 20
  for (let n = 0; n < 4; n++) {
    const mx = x + Math.cos(Math.PI / 4 + Math.PI / 2 * n) * puyoWidth / 2
    const my = y + Math.sin(Math.PI / 4 + Math.PI / 2 * n) * puyoHeight / 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(mx, my)
    ctx.stroke()
  }
}

/**
 * ゲームループ
 * @returns {void}
 */
function gameLoop() {
  const now = Date.now()
  if (now - lastUpdateTime >= 1000 / fps) {
    drawBackground()
    drawStage()
    drawGameoverZone()
    drawField()
    drawFallingPuyo()
    drawNextPuyo()

    if (isGameover()) {
      const fontSize = 60
      const text = "GAME OVER"
      ctx.font = "bold " + fontSize + "px sans-serif"

      const x = (canvas.width - ctx.measureText(text).width) / 2
      const y = (canvas.height - fontSize) / 2
      ctx.beginPath()
      ctx.fillStyle = "#ff0000"
      ctx.fillText(text, x, y)
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 2
      ctx.strokeText(text, x, y)
      return
    } else if (fallingPuyo.some(puyo => !isMovable(puyoPos.x + puyo.x, puyoPos.y + puyo.y + (speed / fps)))) {
      isAllowInput = false
      fix()
      fall()
      fallCount = 0
      requestAnimationFrame(fallLoop)
    } else {
      puyoPos.y += speed / fps
      requestAnimationFrame(gameLoop)
    }

    lastUpdateTime = now
  } else {
    requestAnimationFrame(gameLoop)
  }
}

function fallLoop() {
  const now = Date.now()
  if (now - lastUpdateTime >= 1000 / fps) {
    drawBackground()
    drawStage()
    drawGameoverZone()
    drawField()
    drawNextPuyo()

    for (let y = 0; y < fieldHeight; y++) {
      for (let x = 0; x < fieldWidth; x++) {
        const puyo = field[y][x]
        if (!puyo || puyo.y === y) {
          continue
        }

        const n = fps / 4 - fallCount
        puyo.y += (y - puyo.y) / n
      }
    }

    fallCount++

    if (fallCount > fps / 4) {
      for (let y = 0; y < fieldHeight; y++) {
        for (let x = 0; x < fieldWidth; x++) {
          const puyo = field[y][x]
          if (!puyo || puyo.y === y) {
            continue
          }
          puyo.y = y
        }
      }

      erasePosList.length = 0
      findErasablePos().forEach(pos => {
        erasePosList.push(pos)
      })

      if (erasePosList.length <= 0) {
        isAllowInput = true
        spawn()
        requestAnimationFrame(gameLoop)
      } else {
        eraseCount = 0
        requestAnimationFrame(eraseLoop)
      }
    } else {
      requestAnimationFrame(fallLoop)
    }
    lastUpdateTime = now
  } else {
    requestAnimationFrame(fallLoop)
  }
}

function eraseLoop() {
  const now = Date.now()
  if (now - lastUpdateTime >= 1000 / fps) {
    drawBackground()
    drawStage()
    drawGameoverZone()
    drawField()
    drawNextPuyo()

    erasePosList.forEach(pos => {
      const puyo = field[pos.y][pos.x]

      const n = fps / 4 - eraseCount
      puyo.scale -= puyo.scale / n
    })

    eraseCount++

    if (eraseCount > fps / 4) {
      erasePosList.forEach(pos => {
        field[pos.y][pos.x] = null
      })
      fall()
      fallCount = 0
      requestAnimationFrame(fallLoop)
    } else {
      requestAnimationFrame(eraseLoop)
    }
    lastUpdateTime = now
  } else {
    requestAnimationFrame(eraseLoop)
  }
}

init()
spawn()
gameLoop()

/**
 * キーボード操作
 */
window.addEventListener("keydown", (e) => {
  if (!isAllowInput) {
    return
  }

  const key = e.key
  switch (key) {
    case "ArrowLeft":
      moveLeft()
      break
    case "ArrowRight":
      moveRight()
      break
    case "ArrowDown":
      moveDown()
      break
    case "z":
      rotateLeft()
      break
    case "x":
      rotateRight()
      break
  }
})