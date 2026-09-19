// 注册商导出里"价格 / 估值"列的格式比日期还乱：
//   GoDaddy: "$ 402.00"      （$ 后面带空格）
//   通用:    "$1,234.56"     （千分位逗号）
//   一些场合: "402"           （纯数字）
//   缺值:    "" / "N/A" / "Free" → 返回 null
//
// 曾经的实现是「剥掉一切非数字非小数点字符，然后 parseFloat」。它对上面四种
// 都对，但对下面这些是**静默给出错误金额**，比报错危险得多：
//
//   "1234,56"   → 123456    欧陆小数逗号被当成千分位，金额放大 100 倍
//   "1.234,56"  → 1.23456   欧陆千分位，金额缩小 1000 倍
//   "-402"      → 402       负号被剥掉，符号翻转（注释还写着"负数返回 null"，
//                           但 n < 0 那道判断永远走不到，是死代码）
//   "(402)"     → 402       会计写法的负数，同上
//   "1.2.3"     → 1.2       parseFloat 只吃到第一个小数点为止，悄悄截断
//
// 欧陆格式不是假想：用户在德/法/西语区的 Excel 里打开注册商 CSV 再另存，
// 小数点就会变成逗号。而 purchase_cost / renewal_cost 是 ROI、已实现盈亏、
// 投入合计所有数字的地基——这里错 100 倍，整个组合的账全错，且没有任何提示。
//
// 现在的原则：能确定就正确解析，不能确定就返回 null。null 是"没这个值"，
// 用户在界面上看得见空白；一个错误的数字是看不见的。

/** 小数分隔符的判定：两种分隔符都在时，**最后出现的那个**是小数点。
 *  这条规则对 "1,234.56"（英美）和 "1.234,56"（欧陆）同时成立。 */
function normalizeDecimalSeparator(raw: string): string | null {
  const lastDot = raw.lastIndexOf('.');
  const lastComma = raw.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const groupSep = decimalSep === '.' ? ',' : '.';
    return raw.split(groupSep).join('').replace(decimalSep, '.');
  }

  if (lastComma >= 0) {
    // 只有逗号，得猜。英美千分位每组**恰好 3 位**，所以：
    //   "1,234"    → 3 位 → 千分位 → 1234
    //   "1234,56"  → 2 位 → 小数逗号 → 1234.56
    // 逗号后 1–2 位时当千分位是不可能的（没有 "1,23" 这种写法）。
    const tail = raw.slice(lastComma + 1);
    const looksLikeGrouping = /^\d{3}$/.test(tail) && !/,\d{1,2}$/.test(raw);
    return looksLikeGrouping ? raw.split(',').join('') : raw.replace(/,/g, '.');
  }

  // 只有点，或一个分隔符都没有：按英美口径当小数点。本应用是 USD-only，
  // 注册商导出也都是英美格式，这是唯一合理的默认。
  return raw;
}

export function parseMoneyAmount(input: string | undefined | null): number | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 负号先判、再剥。放在剥离之后判是判不到的——那正是旧实现把 -402 读成
  // 402 的原因。会计写法 "(402)" 同样算负。成本 / 估值不存在负数，与其
  // 翻转符号不如当成"没填"。
  const isNegative = /^\s*[-−]/.test(trimmed) || /^\(.*\)$/.test(trimmed);
  if (isNegative) return null;

  // 留下数字和两种分隔符，其余（$ 、空格、字母、括号）全删
  const cleaned = trimmed.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;

  const normalized = normalizeDecimalSeparator(cleaned);
  if (normalized === null) return null;

  // 归一之后还剩多个小数点 = 输入本身就是坏的（"1.2.3"）。旧实现在这里会
  // 被 parseFloat 截成 1.2，等于凭空编一个金额出来。
  if ((normalized.match(/\./g) ?? []).length > 1) return null;

  // 用 Number 而不是 parseFloat：parseFloat 吃到不认识的字符就停下并返回
  // 前半截，Number 则整体不合法就给 NaN —— 这里要的正是后者。
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
