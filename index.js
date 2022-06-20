/**
 * @author      OA Wu <oawu.tw@gmail.com>
 * @copyright   Copyright (c) 2015 - 2022, @oawu/lcd1602
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const i2c   = require('i2c-bus');
const Queue = require('@oawu/queue')

const ADDRESS               = 0x27
const PORT                  = 0x01
const CLEAR_DISPLAY         = 0x01
const RETURN_HOME           = 0x02
const ENTRY_MODE_SET        = 0x04
const DISPLAY_CONTROL       = 0x08
const CURSOR_SHIFT          = 0x10
const FUNCTION_SET          = 0x20
const SET_CGRAM_ADDR        = 0x40
const SET_DDRAM_ADDR        = 0x80
const ENTRY_RIGHT           = 0x00
const ENTRY_LEFT            = 0x02
const ENTRY_SHIFT_INCREMENT = 0x01
const ENTRY_SHIFT_DECREMENT = 0x00
const DISPLAY_ON            = 0x04
const DISPLAY_OFF           = 0x00
const BLINK_ON              = 0x02
const BLINK_OFF             = 0x00
const CURSOR_ON             = 0x01
const CURSOR_OFF            = 0x00
const DISPLAY_MOVE          = 0x08
const CURSOR_MOVE           = 0x00
const MOVE_RIGHT            = 0x04
const MOVE_LEFT             = 0x00
const BIT8_MODE             = 0x10
const BIT4_MODE             = 0x00
const LINE_2                = 0x08
const LINE_1                = 0x00
const DOTS_5x10             = 0x04
const DOTS_5x8              = 0x00
const LIGHT_ON              = 0x08
const LIGHT_OFF             = 0x07
const MODE_En               = 0x04
const MODE_Rw               = 0x02
const MODE_Rs               = 0x01
const LINE_START            = [0x80, 0xC0, 0x94, 0xD4]

const isLeft = v => {
  v = typeof v == 'string' ? v : 'l'
  v = v.toLowerCase()
  return !['right', 'r'].includes(v)
}

const LCD = function(address = ADDRESS, port = PORT, cols = 16, numLines = 2, dotSize = DOTS_5x8) {
  this._bus        = i2c.openSync(port)
  this._address    = address
  this._numLines   = numLines

  this._beginSet = 0x00 | (numLines > 1 ? LINE_2 : LINE_1)
  this._beginSet |= dotSize != DOTS_5x8 && numLines == 1 ? DOTS_5x10 : DOTS_5x8

  this._rowOffsets = [0x00, 0x40, 0x00 + cols, 0x40 + cols]

  this._functionSet    = FUNCTION_SET    | this._beginSet | BIT4_MODE
  this._entryModeSet   = ENTRY_MODE_SET  | ENTRY_LEFT     | ENTRY_SHIFT_DECREMENT
  this._displayControl = DISPLAY_CONTROL | DISPLAY_ON     | CURSOR_OFF | BLINK_OFF

  // 初始步驟
  this._queue = new Queue()
    .enqueue(next => this.write(0x03, next))
    .enqueue(next => this.write(0x03, next))
    .enqueue(next => this.write(0x03, next))
    .enqueue(next => this.write(0x02, next))
    .enqueue(next => this.write(this._functionSet, next))
    .enqueue(next => this.write(this._displayControl, next))
    .enqueue(next => this.write(this._entryModeSet, next))
    .enqueue(next => this.write(CLEAR_DISPLAY, _ => setTimeout(next, 200)))
}

LCD.prototype.writeCMD = function(cmd, closure) {
  return this._bus.sendByte(this._address, cmd, e => setTimeout(_ => closure && closure(e), 1))
    , this
}

LCD.prototype.write = function(cmd, closure = null, mode = 0) {
  return this.write4Bits(mode | (cmd & 0xF0), _ => this.write4Bits(mode | ((cmd << 4) & 0xF0), closure))
    , this
}

LCD.prototype.write4Bits = function(data, closure = null) {
  return this.writeCMD(data | LIGHT_ON, _ => this.strobe(data, closure))
    , this
}

LCD.prototype.strobe = function(data, closure = null) {
  return this.writeCMD(data | MODE_En | LIGHT_ON,
    _ => setTimeout(
      _ => this.writeCMD(((data & ~MODE_En) | LIGHT_ON),
        _ => setTimeout(
          _ => closure && closure(), 1)), 5))
    , this
}

// 顯示文字
LCD.prototype.text = function(row, col, str, closure = null) {
  if (typeof row == 'string') str = row, row = 0, col = 0
  if (typeof col == 'string') str = col, col = 0
  return this._queue.enqueue(next => this.write(LINE_START[row] + col, next))
    , this.output(str)
}

// 輸出文字
LCD.prototype.output = function(str, closure = null) {
  return str.split('').forEach(c => this._queue.enqueue(next => this.write(c.charCodeAt(0), next, MODE_Rs)))
    , closure && this._queue.enqueue(next => next(closure(str)))
    , this
}

// 清除畫面
LCD.prototype.clear = function(closure = null) {
  return this._queue.enqueue(next => this.write(CLEAR_DISPLAY, next)).enqueue(next => this.write(RETURN_HOME, next))
    , closure && this._queue.enqueue(next => next(closure()))
    , this
}

// 延遲
LCD.prototype.sleep = function(sec = 0, closure = null) {
  return sec > 0 && this._queue.enqueue(next => setTimeout(next, sec * 1000))
    , closure && this._queue.enqueue(next => next(closure(sec)))
    , this
}

// 背光
LCD.prototype.light = function(isOn, closure = null) {
  return this._queue.enqueue(next => this.writeCMD(isOn ? LIGHT_ON : LIGHT_OFF, next))
    , closure && this._queue.enqueue(next => next(closure(isOn)))
    , this
}

// 閃爍游標
LCD.prototype.cursor = function(isOn, closure = null) {
  return this._queue.enqueue(next => this.write(this._displayControl = DISPLAY_CONTROL | (isOn ? (this._displayControl | CURSOR_ON) : (this._displayControl & ~CURSOR_ON)), next))
    , closure && this._queue.enqueue(next => next(closure(isOn)))
    , this
}

// 游標底線
LCD.prototype.blink = function(isOn, closure = null) {
  return this._queue.enqueue(next => this.write(this._displayControl = DISPLAY_CONTROL | (isOn ? (this._displayControl | BLINK_ON) : (this._displayControl & ~BLINK_ON)), next))
    , closure && this._queue.enqueue(next => next(closure(isOn)))
    , this
}

// 設置位置
LCD.prototype.position = function(row, col, closure = null) {
  return this._queue.enqueue(next => this.write(SET_DDRAM_ADDR | (val  + col), next), row = row > this._numLines ? this._numLines - 1 : row, val = row < this._rowOffsets.length ? this._rowOffsets[row] : 0x00)
    , closure && this._queue.enqueue(next => next(closure(row, col)))
    , this
}

// 是否顯示
LCD.prototype.display = function(isOn, closure = null) {
  return this._queue.enqueue(next => this.write(this._displayControl = DISPLAY_CONTROL | (isOn ? (this._displayControl | DISPLAY_ON) : (this._displayControl & ~DISPLAY_ON)), next))
    , closure && this._queue.enqueue(next => next(closure(isOn)))
    , this
}

// 自動滑滾
LCD.prototype.autoShift = function(isOn, closure = null) {
  return this._queue.enqueue(next => this.write(this._entryModeSet = isOn ? (this._entryModeSet | ENTRY_SHIFT_INCREMENT) : (this._entryModeSet & ~ENTRY_SHIFT_INCREMENT), next))
    , closure && this._queue.enqueue(next => next(closure(isOn)))
    , this
}

// 滑滾
LCD.prototype.shift = function(direction, closure = null) {
  return this._queue.enqueue(next => this.write(CURSOR_SHIFT | DISPLAY_MOVE | (isLeft(direction) ? MOVE_LEFT : MOVE_RIGHT), next))
    , closure && this._queue.enqueue(next => next(closure()))
    , this
}

// 文字方向
LCD.prototype.align = function(direction, closure = null) {
  return this._queue.enqueue(next => this.write(this._entryModeSet = isLeft(direction) ? (this._entryModeSet | ENTRY_LEFT) : (this._entryModeSet & ~ENTRY_LEFT), next))
    , closure && this._queue.enqueue(next => next(closure()))
    , this
}

// 註冊多個自定義文字
LCD.prototype.customChars = function(chars = [], closure = null) {
  return this._queue.enqueue(next => this.write(0x40, next))
    , chars.reduce((a, b) => a.concat(b), []).forEach(val => this._queue.enqueue(next => this.write(val, next, MODE_Rs)))
    , closure && this._queue.enqueue(next => next(closure(chars)))
    , this
}

// 註冊單個自定義文字
LCD.prototype.customChar = function(location, lines = [], closure = null) {
  return this._queue.enqueue(next => this.write(SET_CGRAM_ADDR | (location << 3), next), location &= 0x07)
    , lines.forEach(line => this._queue.enqueue(next => this.write(line, next, MODE_Rs)))
    , closure && this._queue.enqueue(next => next(closure(location, lines)))
    , this
}

// 顯示多個自定義文字
LCD.prototype.customs = function(lines = [], closure = null) {
  return lines.map((line, index) => [[LINE_START[index], 0], ...line.map(index => [index])])
    .reduce((a, b) => a.concat(b), [])
    .forEach(([val, mode = MODE_Rs]) => this._queue.enqueue(next => this.write(val, next, mode)))
    , closure && this._queue.enqueue(next => next(closure(lines)))
    , this
}

// 顯示單個自定義文字
LCD.prototype.custom = function(row, col, chars = [], closure = null) {
  if (typeof row == 'string') str = row, row = 0, col = 0
  if (typeof col == 'string') str = col, col = 0
  return this._queue.enqueue(next => this.write(LINE_START[row] + col, next))
    , chars.forEach(char => this._queue.enqueue(next => this.write(char, next, MODE_Rs)))
    , closure && this._queue.enqueue(next => next(closure(lines)))
    , this
}

module.exports = LCD
