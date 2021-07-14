# OA's Md5 Function

一起來用 node.js 控制 LCD1602 吧！ 🖥


## 說明
* 這是一個利用 [`i2c-bus`](https://www.npmjs.com/package/i2c-bus) 來控制 [`LCD1602 顯示器`](http://wiki.sunfounder.cc/index.php?title=LCD1602_Module) 的工具，主要是使用 [Node.js](https://nodejs.org/en/) 製作的 [NPM](https://www.npmjs.com/) 套件。
* 函式庫做法主要參考了 [python-liquidcrystal_i2c](https://github.com/pl31/python-liquidcrystal_i2c/blob/master/liquidcrystal_i2c/liquidcrystal_i2c.py) 與 [RPi_I2C_LCD_driver](https://github.com/eleparts/RPi_I2C_LCD_driver/blob/master/original_example/examples.py) 的邏輯部分。

## 安裝

```shell
npm install @oawu/lcd1602
```


## 使用

引入 `require('@oawu/lcd1602')` 即可使用 **lcd1602** 功能，如下範例：

```javascript

  const LCD = require('./index.js')
  const lcd = new LCD()
  lcd.text(0, 0, 'hello world!')

```
