/**
 * คำนวณยอดใบกำกับ + จำนวนเงินตัวอักษร
 * ไฟล์นี้ต้องเหมือน liff/calc.js ทุกตัวอักษร (test/calc.test.js เช็คให้)
 * คิดเงินเป็น "สตางค์" (จำนวนเต็ม) ทั้งหมด เพื่อไม่ให้ทศนิยมเพี้ยน
 * ทุกจุดในเอกสาร (ตาราง, ยอดรวม, VAT, ตัวอักษร, ประวัติ) ต้องเอาค่าจาก calculate() ตัวเดียวนี้
 */
var InvoiceCalc = (function () {
  var VAT_PERCENT = 7;
  var MAX_ITEMS = 10;

  // "1,234.5" -> 123450 (หน่วย 1/100) · ไม่รับติดลบ/ทศนิยมเกิน 2 ตำแหน่ง
  function toHundredths(v, field) {
    var s = String(v == null ? '' : v).replace(/,/g, '').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(s)) {
      throw new Error(field + ' ต้องเป็นตัวเลข ไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง (ได้ "' + v + '")');
    }
    var p = s.split('.');
    return parseInt(p[0], 10) * 100 + parseInt(((p[1] || '') + '00').slice(0, 2), 10);
  }

  // หารแล้วปัดครึ่งขึ้น (จำนวนเต็มบวก)
  function divRound(n, d) {
    return Math.floor((2 * n + d) / (2 * d));
  }

  // 289000 -> "2,890.00"
  function money(satang) {
    var baht = Math.floor(satang / 100);
    var st = satang % 100;
    return String(baht).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + (st < 10 ? '0' : '') + st;
  }

  // 150 -> "1.5", 100 -> "1"
  function qtyText(h) {
    var s = money(h).replace(/\.?0+$/, '');
    return s === '' ? '0' : s;
  }

  var DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  var PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

  // อ่านเลข 0..999999 · hasHigher = มีหลักล้านขึ้นไปนำหน้า (ใช้ตัดสิน "เอ็ด")
  function readGroup(n, hasHigher) {
    var s = String(n), out = '';
    for (var i = 0; i < s.length; i++) {
      var d = +s[i], pos = s.length - 1 - i;
      if (d === 0) continue;
      if (pos === 1 && d === 1) out += 'สิบ';
      else if (pos === 1 && d === 2) out += 'ยี่สิบ';
      else if (pos === 0 && d === 1 && (n > 1 || hasHigher)) out += 'เอ็ด';
      else out += DIGITS[d] + PLACES[pos];
    }
    return out;
  }

  // อ่านจำนวนเต็มบวกทุกขนาด (แบ่งทีละ 6 หลัก = ล้าน)
  function readInt(n) {
    if (n === 0) return '';
    var high = Math.floor(n / 1000000), low = n % 1000000;
    var out = high > 0 ? readInt(high) + 'ล้าน' : '';
    return out + readGroup(low, high > 0);
  }

  // 289000 -> "สองพันแปดร้อยเก้าสิบบาทถ้วน"
  function bahtText(satang) {
    var baht = Math.floor(satang / 100), st = satang % 100;
    if (baht === 0 && st === 0) return 'ศูนย์บาทถ้วน';
    var out = baht > 0 ? readInt(baht) + 'บาท' : '';
    return out + (st > 0 ? readInt(st) + 'สตางค์' : 'ถ้วน');
  }

  /**
   * items: [{code, name, qty, price}] · vatMode: 'include' (ราคารวม VAT แล้ว = แบบต้นฉบับ) | 'exclude'
   * แถวที่ว่างทั้งแถวจะถูกข้าม
   */
  function calculate(items, vatMode) {
    if (vatMode !== 'include' && vatMode !== 'exclude') throw new Error('vatMode ต้องเป็น include หรือ exclude');
    var rows = (items || []).filter(function (it) {
      return it && [it.code, it.name, it.qty, it.price].some(function (x) { return String(x == null ? '' : x).trim() !== ''; });
    });
    if (rows.length === 0) throw new Error('ต้องมีสินค้าอย่างน้อย 1 รายการ');
    if (rows.length > MAX_ITEMS) throw new Error('ใส่สินค้าได้สูงสุด ' + MAX_ITEMS + ' รายการ (ให้พอดี A4 หน้าเดียว)');

    var sum = 0;
    var lines = rows.map(function (it, i) {
      var n = i + 1;
      var name = String(it.name || '').trim();
      if (!name) throw new Error('รายการที่ ' + n + ': ยังไม่ได้ใส่ชื่อสินค้า');
      var q = toHundredths(it.qty, 'รายการที่ ' + n + ' จำนวน');
      if (q === 0) throw new Error('รายการที่ ' + n + ': จำนวนต้องมากกว่า 0');
      var p = toHundredths(it.price, 'รายการที่ ' + n + ' ราคา');
      var amount = divRound(q * p, 100);
      sum += amount;
      return {
        no: String(n), code: String(it.code || '').trim(), name: name,
        qty: qtyText(q), price: money(p), amount: money(amount), amountSatang: amount
      };
    });

    var gross, vat, net;
    if (vatMode === 'include') {
      gross = sum;
      vat = divRound(gross * VAT_PERCENT, 100 + VAT_PERCENT);
      net = gross - vat;
    } else {
      net = sum;
      vat = divRound(net * VAT_PERCENT, 100);
      gross = net + vat;
    }
    return {
      lines: lines, vatMode: vatMode, vatPercent: VAT_PERCENT.toFixed(2) + '%',
      grossSatang: gross, vatSatang: vat, netSatang: net,
      gross: money(gross), vat: money(vat), net: money(net),
      bahtText: bahtText(gross)
    };
  }

  return { calculate: calculate, bahtText: bahtText, money: money, MAX_ITEMS: MAX_ITEMS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = InvoiceCalc;
