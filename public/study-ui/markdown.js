(() => {
'use strict';
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mathPlugin(md) {
    const escaped = (source, index) => {
      let count = 0;
      while (index > 0 && source[--index] === '\\') count++;
      return count % 2 === 1;
    };
    md.inline.ruler.before('escape', 'study_math', (parser, silent) => {
      const source = parser.src;
      const start = parser.pos;
      let open, close, display = false;
      if (source.startsWith('\\(', start)) { open = '\\('; close = '\\)'; }
      else if (source.startsWith('\\[', start)) { open = '\\['; close = '\\]'; display = true; }
      else if (source.startsWith('$$', start)) { open = '$$'; close = '$$'; display = true; }
      else if (source[start] === '$') { open = close = '$'; }
      else return false;
      const contentStart = start + open.length;
      if (open === '$' && (/\s/.test(source[contentStart] || '') || !source[contentStart])) return false;
      let end = source.indexOf(close, contentStart);
      while (end !== -1 && escaped(source, end)) end = source.indexOf(close, end + close.length);
      if (end === -1) return false;
      const text = source.slice(contentStart, end);
      if (!text.trim() || (open === '$' && (/\s$/.test(text) || /\n/.test(text) || /\d/.test(source[end + 1] || '')))) return false;
      if (!silent) {
        const token = parser.push('study_math', '', 0);
        token.content = text;
        token.markup = open;
        token.meta = {display, original:source.slice(start,end + close.length)};
      }
      parser.pos = end + close.length;
      return true;
    });
    md.block.ruler.before('fence', 'study_math_block', (parser, startLine, endLine, silent) => {
      const start = parser.bMarks[startLine] + parser.tShift[startLine];
      const first = parser.src.slice(start, parser.eMarks[startLine]).trim();
      const open = first.startsWith('$$') ? '$$' : first.startsWith('\\[') ? '\\[' : null;
      if (!open) return false;
      const close = open === '$$' ? '$$' : '\\]';
      const lines = [];
      let lastLine = startLine;
      let found = false;
      let trailing = '';
      for (; lastLine < endLine; lastLine++) {
        const line = parser.src.slice(parser.bMarks[lastLine] + parser.tShift[lastLine], parser.eMarks[lastLine]);
        const current = lastLine === startLine ? line.slice(open.length) : line;
        let at = current.indexOf(close);
        while (at >= 0 && escaped(current, at)) at = current.indexOf(close, at + close.length);
        if (at >= 0) {
          lines.push(current.slice(0, at));
          trailing = current.slice(at + close.length);
          found = true;
          break;
        }
        lines.push(current);
      }
      if (!found || trailing.trim()) return false;
      if (silent) return true;
      const token = parser.push('study_math', '', 0);
      token.block = true;
      token.map = [startLine,lastLine + 1];
      token.content = lines.join('\n').trim();
      token.meta = {display:true,original:open + lines.join('\n') + close};
      parser.line = lastLine + 1;
      return true;
    }, {alt:['paragraph','reference','blockquote','list']});
    md.renderer.rules.study_math = (tokens, index) => {
      const token = tokens[index];
      try {
        return katex.renderToString(token.content, {displayMode:token.meta.display,throwOnError:true,trust:false,strict:'ignore',maxExpand:1000,output:'htmlAndMathml'});
      } catch {
        return '<code class="math-unparsed' + (token.meta.display ? ' block' : '') + '">' + escapeHTML(token.meta.original) + '</code>';
      }
    };
  }

  const markdown = window.markdownit ? window.markdownit({html:false,breaks:true,linkify:true,typographer:false}).use(mathPlugin) : null;
  if (markdown) {
    markdown.inline.ruler.before('emphasis','study_answer_blank',(parser,silent) => {
      const match = parser.src.slice(parser.pos).match(/^_{3,}/);
      if (!match) return false;
      if (!silent) {
        const token = parser.push('text','',0);
        token.content = match[0];
      }
      parser.pos += match[0].length;
      return true;
    });
    markdown.inline.ruler.before('html_inline','study_semantic_tag',(parser,silent) => {
      const match = parser.src.slice(parser.pos).match(/^<(?:\/?(?:sup|sub)|br\s*\/?)>/i);
      if (!match) return false;
      if (!silent) {
        const token = parser.push('html_inline','',0);
        token.content = match[0];
      }
      parser.pos += match[0].length;
      return true;
    });
    const defaultLinkOpen = markdown.renderer.rules.link_open || ((tokens,index,options,env,self) => self.renderToken(tokens,index,options));
    markdown.renderer.rules.link_open = (tokens,index,options,env,self) => {
      tokens[index].attrSet('target','_blank');
      tokens[index].attrSet('rel','noopener noreferrer');
      return defaultLinkOpen(tokens,index,options,env,self);
    };
    markdown.renderer.rules.image = (tokens,index) => {
      const token = tokens[index];
      const src = token.attrGet('src') || '';
      const label = token.content || '图片';
      return /^https?:\/\//i.test(src) ? '<a href="' + escapeHTML(src) + '" target="_blank" rel="noopener noreferrer">图片：' + escapeHTML(label) + '</a>' : escapeHTML('[图片：' + label + ']');
    };
  }
  function renderMarkdown(node, value) {
    node.classList.add('markdown-body');
    if (!markdown || !window.DOMPurify || !window.katex) {
      node.textContent = String(value || '');
      node.style.whiteSpace = 'pre-wrap';
      return;
    }
    node.innerHTML = DOMPurify.sanitize(markdown.render(String(value || '')), {
      USE_PROFILES:{html:true,mathMl:true,svg:true},
      ADD_ATTR:['target'],
      FORBID_TAGS:['style','script','iframe','object','embed','form','input','button','textarea']
    });
  }
  // The same renderer is used for the query and every recorded message.
  window.StudyModeViewer = Object.freeze({renderMarkdown});

})();
