export const marker = /__engine(\d+)__/u;

const TEXT = 0;
const TAG = 1;
const QUOTED = 2;
const COMMENT = 3;
const RAW = 4;

const RAW_TEXT = ['script', 'style', 'textarea', 'title'];

function isTagName(string: string, at: number, name: string) {
  for (let i = 0; i < name.length; i++) {
    if (string.charAt(at + i).toLowerCase() !== name[i]) {
      return false;
    }
  }
  const next = string.charAt(at + name.length);
  return next === '>' || next === '/' || next <= ' ';
}

/** Places a marker at each interpolation, chosen by the parser state at that point. */
export function markup(strings: TemplateStringsArray) {
  let html = '';
  let state = TEXT;
  let quote = '';
  let raw = '';
  let afterEquals = false;
  const tags: number[] = [];
  const texts: boolean[] = [];
  for (const [index, string] of strings.entries()) {
    html += string;
    for (let i = 0; i < string.length; i++) {
      const char = string[i];
      switch (state) {
        case TEXT:
          if (char !== '<') {
            break;
          }
          if (string.startsWith('!--', i + 1)) {
            state = COMMENT;
          } else {
            const next = string.charAt(i + 1);
            if (
              next === '' ||
              next === '/' ||
              (next >= 'a' && next <= 'z') ||
              (next >= 'A' && next <= 'Z')
            ) {
              state = TAG;
              raw = '';
              for (const name of RAW_TEXT) {
                if (isTagName(string, i + 1, name)) {
                  raw = name;
                  break;
                }
              }
            }
          }
          break;
        case TAG:
          if (char === '>') {
            state = raw === '' ? TEXT : RAW;
          } else if ((char === '"' || char === "'") && afterEquals) {
            quote = char;
            state = QUOTED;
          }
          if (char > ' ') {
            afterEquals = char === '=';
          }
          break;
        case QUOTED:
          if (char === quote) {
            state = TAG;
          }
          break;
        case RAW:
          if (
            char === '<' &&
            string[i + 1] === '/' &&
            isTagName(string, i + 2, raw)
          ) {
            state = TAG;
            raw = '';
          }
          break;
        default:
          if (char === '>' && string.endsWith('--', i)) {
            state = TEXT;
          }
      }
    }

    if (index === strings.length - 1) {
      break;
    }
    texts.push(state === TEXT);
    if (state === TEXT) {
      html += `<!--__engine${index}__-->`;
    } else if (state !== TAG) {
      html += `__engine${index}__`;
    } else if (html.endsWith('<')) {
      tags.push(index);
      html += `x__engine${index}__`;
    } else if (html.endsWith('</')) {
      html += `x__engine${tags.pop()}__`;
    } else {
      html += strings[index + 1].startsWith('/>')
        ? `__engine${index}__ `
        : `__engine${index}__`;
    }
  }

  return { html: html.trim(), texts };
}

/** Separates static text from interpolation indexes. */
export function splitParts(text: string) {
  const parts: (string | number)[] = text.split(marker);
  for (let partIndex = 1; partIndex < parts.length; partIndex += 2) {
    parts[partIndex] = Number(parts[partIndex]);
  }

  return parts;
}
