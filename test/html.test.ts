import { describe, expect, it } from 'vitest';
import {
  element,
  html,
  mhtml,
  text,
  type Interpolation,
} from '../src/html/index.ts';

const render = (strings: TemplateStringsArray, ...values: Interpolation[]) =>
  (html(strings, ...values) as Element).outerHTML;

describe('html', () => {
  it('inserts interpolated strings as text, never as markup', () => {
    const payload = '<img src=x onerror="alert(1)">';
    const node = html`<p>${payload}</p>` as Element;

    expect(node.querySelector('img')).toBeNull();
    expect(node.textContent).toBe(payload);
  });

  it('fills quoted, unquoted and mixed attributes', () => {
    const quote = '"><script>x</script>';
    expect(
      render`<a class=${'a'} title="${quote}" data-x="pre ${1} mid ${2} post"></a>`,
    ).toBe(
      '<a class="a" title="&quot;><script>x</script>" data-x="pre 1 mid 2 post"></a>',
    );
  });

  it('inserts nodes and arrays of nodes in place', () => {
    const items = ['a', 'b'].map((label) => html`<li>${label}</li>`);
    // prettier-ignore
    const list = html`<ul>${element('hr')}${items}</ul>` as Element;

    expect(list.outerHTML).toBe('<ul><hr><li>a</li><li>b</li></ul>');
    expect(list.children[1]).toBe(items[0]);
  });

  it('skips null and undefined, keeps other values as text', () => {
    expect(render`<p>${null}${undefined}${0}${false}</p>`).toBe(
      '<p>0false</p>',
    );
  });

  it('reuses the parsed template per call site and never shares nodes', () => {
    const make = (label: string) => html`<b>${label}</b>` as Element;
    const first = make('one');
    const second = make('two');

    expect(first).not.toBe(second);
    expect([first.textContent, second.textContent]).toEqual(['one', 'two']);
  });

  it('parses context-sensitive roots like table rows', () => {
    const row = html`<tr>
      <td>${'cell'}</td>
    </tr>` as Element;
    expect(row.tagName).toBe('TR');
  });

  it('html requires one root, mhtml returns all', () => {
    expect(() => html`<a></a><b></b>`).toThrow(/exactly one root/u);
    expect(mhtml`<a></a><b></b>`).toHaveLength(2);
  });

  it('creates text nodes', () => {
    expect(text('hi').data).toBe('hi');
  });
});
