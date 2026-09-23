/**
 * 会话翻档提示音判定（diffSessionChimes）单元测试 —— 钉住三条约定：
 *   翻 waiting 一律响（含 subagent 权限申请）、翻 success 只有自己的会话响（subagent 完成不噪）、
 *   首拍记基线不重放历史。
 *
 * 跑法：node --experimental-strip-types --test src/shared/sound.test.ts
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { diffSessionChimes, mergeSessionChimes } from './sound';

describe('mergeSessionChimes —— 一拍多翻档合并（各至多一声，done 优先）', () => {
  test('去重 + 排序', () => {
    assert.deepEqual(mergeSessionChimes(['waiting', 'done', 'waiting']), ['done', 'waiting']);
    assert.deepEqual(mergeSessionChimes([]), []);
    assert.deepEqual(mergeSessionChimes(['waiting']), ['waiting']);
  });
});

describe('diffSessionChimes —— 会话翻档 → 提示音', () => {
  test('首拍只记基线：历史状态不重放', () => {
    const prev = new Map<string, string>();
    const kinds = diffSessionChimes(
      prev,
      [
        { id: 'a', state: 'success' },
        { id: 'b', state: 'waiting' },
      ],
      true,
    );
    assert.deepEqual(kinds, []);
    assert.equal(prev.get('a'), 'success');
  });

  test('翻 waiting 一律响：用户会话与 subagent 权限申请同样需要响应', () => {
    const prev = new Map([
      ['a', 'working'],
      ['s', 'working'],
    ]);
    const kinds = diffSessionChimes(prev, [
      { id: 'a', state: 'waiting' },
      { id: 's', state: 'waiting', subagent: true },
    ]);
    assert.deepEqual(kinds, ['waiting']); // 两处翻档合并一声
  });

  test('翻 success 只有用户会话响（subagent 完成不响防刷屏）', () => {
    const prev = new Map([['s', 'working']]);
    assert.deepEqual(
      diffSessionChimes(prev, [{ id: 's', state: 'success', subagent: true }]),
      [],
    );
    prev.set('a', 'result');
    assert.deepEqual(diffSessionChimes(prev, [{ id: 'a', state: 'success' }]), ['done']);
  });

  test('同档不重复响；一拍双翻 waiting+done 合并两声（done 优先）；消失会话清出 prev', () => {
    const prev = new Map([
      ['a', 'success'],
      ['b', 'result'],
    ]);
    assert.deepEqual(diffSessionChimes(prev, [{ id: 'a', state: 'success' }]), []); // 同档静默
    const kinds = diffSessionChimes(prev, [
      { id: 'b', state: 'success' },
      { id: 'c', state: 'waiting' },
    ]);
    assert.deepEqual(kinds, ['done', 'waiting']);
    prev.set('gone', 'working');
    diffSessionChimes(prev, [{ id: 'b', state: 'success' }]);
    assert.equal(prev.has('gone'), false);
  });
});
