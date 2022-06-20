#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# 
# @author      OA Wu <oawu.tw@gmail.com>
# @copyright   Copyright (c) 2015 - 2022, @oawu/lcd1602
# @license     http://opensource.org/licenses/MIT  MIT License
# @link        https://www.ioa.tw/
# 

import time
import smbus

ADDRESS               = 0x27
PORT                  = 0x01
CLEAR_DISPLAY         = 0x01
RETURN_HOME           = 0x02
ENTRY_MODE_SET        = 0x04
DISPLAY_CONTROL       = 0x08
CURSOR_SHIFT          = 0x10
FUNCTION_SET          = 0x20
SET_CGRAM_ADDR        = 0x40
SET_DDRAM_ADDR        = 0x80
ENTRY_RIGHT           = 0x00
ENTRY_LEFT            = 0x02
ENTRY_SHIFT_INCREMENT = 0x01
ENTRY_SHIFT_DECREMENT = 0x00
DISPLAY_ON            = 0x04
DISPLAY_OFF           = 0x00
BLINK_ON              = 0x02
BLINK_OFF             = 0x00
CURSOR_ON             = 0x01
CURSOR_OFF            = 0x00
DISPLAY_MOVE          = 0x08
CURSOR_MOVE           = 0x00
MOVE_RIGHT            = 0x04
MOVE_LEFT             = 0x00
BIT8_MODE             = 0x10
BIT4_MODE             = 0x00
LINE_2                = 0x08
LINE_1                = 0x00
DOTS_5x10             = 0x04
DOTS_5x8              = 0x00
LIGHT_ON              = 0x08
LIGHT_OFF             = 0x07
MODE_En               = 0x04
MODE_Rw               = 0x02
MODE_Rs               = 0x01
LINE_START            = [0x80, 0xC0, 0x94, 0xD4]

class LCD:
  _bus            = None
  _address        = ADDRESS
  _numLines       = 2
  _beginSet       = 0x00
  _rowOffsets     = [0x00, 0x40, 0x00, 0x40]
  _functionSet    = FUNCTION_SET
  _entryModeSet   = ENTRY_MODE_SET
  _displayControl = DISPLAY_CONTROL

  def __init__(self, addr = ADDRESS, port = PORT, cols = 16, numLines = 2, dotSize = DOTS_5x8):
    self._bus      = smbus.SMBus(port)
    self._address  = addr
    self._numLines = numLines

    self._beginSet |= LINE_2 if numLines > 1 else LINE_1
    self._beginSet |= DOTS_5x10 if dotSize != DOTS_5x8 and numLines == 1 else DOTS_5x8

    self._rowOffsets[0] = 0x00
    self._rowOffsets[1] = 0x40
    self._rowOffsets[2] = 0x00 + cols
    self._rowOffsets[3] = 0x40 + cols

    self._functionSet    = FUNCTION_SET    | self._beginSet | BIT4_MODE
    self._entryModeSet   = ENTRY_MODE_SET  | ENTRY_LEFT     | ENTRY_SHIFT_DECREMENT
    self._displayControl = DISPLAY_CONTROL | DISPLAY_ON     | CURSOR_OFF | BLINK_OFF

    self.__write(0x03)
    self.__write(0x03)
    self.__write(0x03)  
    self.__write(0x02)   

    self.__write(self._functionSet)
    self.__write(self._displayControl)                         
    self.__write(self._entryModeSet)
    self.__write(CLEAR_DISPLAY)

    time.sleep(0.2)

  def __writeCMD(self, cmd):
    self._bus.write_byte(self._address, cmd)
    time.sleep(0.0001) 

  def __write(self, cmd, mode = 0):
    self.__write4Bits(mode | (cmd & 0xF0))
    self.__write4Bits(mode | ((cmd << 4) & 0xF0))

  def __write4Bits(self, data):
    self.__writeCMD(data | LIGHT_ON)
    self.__strobe(data)

  def __strobe(self, data):
    self.__writeCMD(data | MODE_En | LIGHT_ON)
    time.sleep(.0005)
    self.__writeCMD(((data & ~MODE_En) | LIGHT_ON))
    time.sleep(.0001)

  def __isLeft(self, direction):
    direction = direction.lower()
    return not (direction == 'right' or direction == 'r')

  # 顯示文字
  def text(self, row, col, string):
    self.__write(LINE_START[row] + offset)
    self.output(string)

  # 輸出文字
  def output(self, string):
    for char in string:
      self.__write(ord(char), MODE_Rs)

  # 清除畫面
  def clear(self):
    self.__write(CLEAR_DISPLAY)
    self.__write(RETURN_HOME)

  # 背光
  def light(self, isOn):
    self.__writeCMD(LIGHT_ON if isOn else LIGHT_OFF)

  # 閃爍游標
  def cursor(self, isOn):
    self._displayControl = DISPLAY_CONTROL | ((self._displayControl | CURSOR_ON) if isOn else (self._displayControl & ~CURSOR_ON))
    self.__write(self._displayControl)

  # 游標底線
  def blink(self, isOn):
    self._displayControl = DISPLAY_CONTROL | ((self._displayControl | BLINK_ON) if isOn else (self._displayControl & ~BLINK_ON))
    self.__write(self._displayControl)

  # 設置位置
  def position(self, row, col):
    row = self._numLines - 1 if row > self._numLines else row
    val = self._rowOffsets[row] if row < len(self._rowOffsets) else 0x00
    self.__write(SET_DDRAM_ADDR | (val  + col))

  # 是否顯示
  def display(self, isOn):
    self._displayControl = DISPLAY_CONTROL | ((self._displayControl | DISPLAY_ON) if isOn else (self._displayControl & ~DISPLAY_ON))
    self.__write(self._displayControl)

  # 自動滑滾
  def autoShift(self, isOn):
    self._entryModeSet = (self._entryModeSet | ENTRY_SHIFT_INCREMENT) if isOn else (self._entryModeSet & ~ENTRY_SHIFT_INCREMENT)
    self.__write(self._entryModeSet)

  # 滑滾
  def shift(self, direction):
    self.__write(CURSOR_SHIFT | DISPLAY_MOVE | (MOVE_LEFT if self.__isLeft(direction) else MOVE_RIGHT))

  # 文字方向
  def align(self, direction):
    self._entryModeSet = (self._entryModeSet | ENTRY_LEFT) if self.__isLeft(direction) else (self._entryModeSet & ~ENTRY_LEFT)
    self.__write(self._entryModeSet)

  # 註冊多個自定義文字
  def customChars(self, chars = []):
    self.__write(0x40)
    for lines in chars:
      for line in lines:
        self.__write(line, MODE_Rs)

  # 註冊單個自定義文字
  def customChar(self, location, lines = []):
    location &= 0x07
    self.__write(SET_CGRAM_ADDR | (location << 3))
    for line in lines:
      self.__write(line, MODE_Rs)

  # 顯示多個自定義文字
  def customs(self, lines = []):
    for index, chars in enumerate(lines):
      self.__write(LINE_START[index])
      for char in chars:
        self.__write(char, MODE_Rs)

  # 顯示單個自定義文字
  def custom(self, row, col, chars = []):
    self.__write(LINE_START[row] + col)
    for char in chars:
      self.__write(char, MODE_Rs)
