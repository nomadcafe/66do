import { sellGrossUSD } from './sellProceeds';
import type { TransactionWithRequiredFields } from '../types/transaction';

export interface TransactionAmountDisplay {
  /** 展示用金额。有折算副本时取折算后的（分期按实际已收）。 */
  amount: number;
  /** 方向符号。0 不标方向——免费 transfer（push / 同注册商内部转移）金额就是 0，
   *  写成 "−$0.00" 看着像笔亏损。 */
  sign: '+' | '-' | '';
  /** 折算后和账面不一致时，账面上的合同金额；一致时为 null。
   *  UI 可以据此补一行「标价 $X」的小字。 */
  listed: number | null;
}

/**
 * 一笔交易在列表里该显示多少钱、带什么符号。
 *
 * 同一段逻辑原本在三个地方各写了一份：交易列表的行、域名表格展开后的历史、
 * 周报的「最近动态」卡片。三份各有各的毛病：
 *   - 三份都是 `sign = isSell ? '+' : '-'`，0 元的 transfer 渲染成 "−$0.00"；
 *   - 域名表格那份直接读 tx.amount，没有折算。于是一笔标价 $50,000、实收
 *     $10,000 的分期，在交易列表里显示 +$10,000（下面还带「标价 $50,000」），
 *     在域名表格展开行里显示 +$50,000。同一笔钱，两个屏幕两个数。
 *
 * 折算与否取决于调用方传不传 metricsTx（transactionsForMetrics 里的同 id 副本）。
 * 不传就退回账面金额，行为与合并前一致。
 */
export function transactionAmountDisplay(
  tx: TransactionWithRequiredFields,
  metricsTx?: TransactionWithRequiredFields
): TransactionAmountDisplay {
  const isSell = tx.type === 'sell';
  const listedGross = sellGrossUSD(tx);
  const adjustedGross = metricsTx ? sellGrossUSD(metricsTx) : listedGross;

  // 只有 sell 有折算的余地；其它类型 metrics 副本与原始交易金额相同。
  const showSplit = isSell && Math.abs(adjustedGross - listedGross) > 0.005;
  const amount = showSplit ? adjustedGross : listedGross;

  return {
    amount,
    sign: amount === 0 ? '' : isSell ? '+' : '-',
    listed: showSplit ? listedGross : null,
  };
}
