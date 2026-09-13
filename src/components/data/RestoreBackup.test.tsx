/**
 * 「恢复备份」页的守卫。
 *
 * 这条路径以前既不校验也不报错：JSON.parse 失败只 console.error（界面毫无
 * 反应），解析成功但不是备份时上层取不到 domains/transactions，就拿当前数据
 * 原样存一遍再提示"恢复成功"——选错文件却被告知成功。
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import DataImportExport from './DataImportExport';

function setup() {
  const onRestore = vi.fn();
  render(
    <I18nProvider>
      <DataImportExport
        onImport={vi.fn()}
        onExport={vi.fn()}
        onRestore={onRestore}
        existingDomainNames={[]}
      />
    </I18nProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: /restore backup/i }));
  // 恢复页只有这一个 file input
  const input = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
  return { onRestore, input };
}

const drop = (input: HTMLInputElement, text: string) =>
  fireEvent.change(input, {
    target: { files: [new File([text], 'backup.json', { type: 'application/json' })] },
  });

describe('恢复备份', () => {
  it('文件不是合法 JSON 时报错，而不是界面毫无反应', async () => {
    const { onRestore, input } = setup();
    drop(input, 'not json at all {{{');
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText(/not valid JSON/i)).toBeTruthy();
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('JSON 合法但不是备份时拒绝，不再假装恢复成功', async () => {
    const { onRestore, input } = setup();
    drop(input, JSON.stringify({ somethingElse: 1 }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('domains 里缺 domain_name 的行会被指出来', async () => {
    const { onRestore, input } = setup();
    drop(input, JSON.stringify({ domains: [{ id: 'a' }] }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('真备份照常下发', async () => {
    const { onRestore, input } = setup();
    const backup = { domains: [{ id: 'a', domain_name: 'example.com' }], transactions: [] };
    drop(input, JSON.stringify(backup));
    await waitFor(() => expect(onRestore).toHaveBeenCalledTimes(1));
    expect(onRestore.mock.calls[0][0]).toEqual(backup);
  });

  it('警告文案说的是合并，不是「完全替换」——saveData 根本没有删除路径', () => {
    setup();
    expect(screen.getByText(/merges the backup/i)).toBeTruthy();
    expect(screen.queryByText(/completely replace/i)).toBeNull();
  });
});
