/* Build-only: color adapters. No website runtime dependency. */
const postcss = require("postcss");
const values = require("postcss-value-parser");
const preservedVariables = /^(?:--team-|--game-|--brand-|--avatar-|--logo-|--banner-|--.*(?:state|status)-(?:fg|bg|border|color))/;
const colorProps = /^(?:color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?(?:-color)?|outline(?:-color)?|fill|stroke|caret-color|accent-color|text-decoration-color|column-rule(?:-color)?|color-scheme)$/;

function rgb(word) {
  if (word === 'white') return [1,1,1,1];
  if (word === 'black') return [0,0,0,1];
  if (/^#[0-9a-f]{3,8}$/i.test(word)) {
    let h=word.slice(1);
    if (h.length===3 || h.length===4) h=h.split('').map(c=>c+c).join('');
    if (h.length!==6 && h.length!==8) return null;
    return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255,h.length===8?parseInt(h.slice(6,8),16)/255:1];
  }
  return null;
}
function hue(r,g,b) {
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  if (!d) return 0;
  let h=max===r?(g-b)/d:(max===g?2+(b-r)/d:4+(r-g)/d);
  return ((h*60)%360+360)%360;
}
function family(c) {
  const [r,g,b]=c,max=Math.max(r,g,b),min=Math.min(r,g,b),s=max?(max-min)/max:0;
  const h=hue(r,g,b);
  if (s<.23 || max-min<.10) return 'neutral';
  if (h<18 || h>335) return 'danger';
  if (h<78) return 'warning';
  if (h<166) return 'success';
  if (h<266) return 'blue';
  return 'purple';
}
function variable(name) { return 'var(--sbw-theme-'+name+')'; }
function literal(c, context, selector) {
  const max=Math.max(...c.slice(0,3)),min=Math.min(...c.slice(0,3));
  const f=family(c), dark=max<.34;
  let token;
  if (context==='border') token=(f!=='neutral' && !dark)?(f==='blue'?'border':f):'border';
  else if (context==='background') {
    if (f!=='neutral' && !dark) token=f==='blue'?'action':f+'-soft';
    else if (dark) token='deep';
    else if (max>.94) token='panel';
    else if (/\b(?:body|html)\b/.test(selector) && min>.60) token='page';
    else token='soft';
  } else {
    if (dark || min>.84) token='text';
    else if (f==='neutral') token='muted';
    else token=f==='blue'?'accent':f;
  }
  if (c[3]===0) return 'transparent';
  if (c[3]<1) return 'color-mix(in srgb, '+variable(token)+' '+Math.round(c[3]*10000)/100+'%, transparent)';
  return variable(token);
}
function semantic(name, context) {
  if (preservedVariables.test(name) || name.startsWith('--sbw-theme-')) return null;
  const n=name.toLowerCase();
  if (/shadow|radius|width|height|size|font|gutter|max|gap|position|zoom|rgb/.test(n)) return null;
  const status = /danger|error|\bred\b/.test(n)?'danger':/success|green/.test(n)?'success':/warning|amber|gold/.test(n)?'warning':/purple/.test(n)?'purple':null;
  const subdued=/soft|background|bg|surface/.test(n);
  if (status) return variable(context==='background'?status+'-soft':status);
  if (context==='border') {
    if (/focus/.test(n)) return variable('focus');
    if (/border|line|blue|cyan|navy|accent|text|ink|white|panel|surface/.test(n)) return variable('border');
  }
  if (/accent|cyan|blue|focus/.test(n)) {
    if (context==='background') return variable(subdued?'soft':'action');
    return variable('accent');
  }
  if (/muted|secondary|disabled/.test(n)) return variable(context==='background'?'soft':'muted');
  if (/border|line/.test(n)) return variable('border');
  if (/silver/.test(n)) return variable(context==='background'?'soft':'text');
  if (/navy|dark|deep|ink|heading/.test(n)) return variable(context==='background'?'deep':'text');
  if (/field|input/.test(n)) return variable(context==='background'?'field':'text');
  if (/panel|surface|card|white/.test(n)) return variable(context==='background'?(/soft/.test(n)?'soft':/strong/.test(n)?'raised':'panel'):'text');
  if (/background|(?:^|-)bg(?:$|-)|header/.test(n)) return variable(context==='background'?(/soft/.test(n)?'soft':'page'):'text');
  if (/text|soft|on-navy/.test(n)) return variable(context==='background'?'soft':/soft/.test(n)?'muted':'text');
  return null;
}
function transform(value, context, selector, defs, stack=[]) {
  const tree=values(value);let changed=false;
  function visit(nodes) {
    for (const node of nodes) {
      if(node.type==='function') {
        const fn=node.value.toLowerCase();
        if(fn==='url') continue;
        if(fn==='var') {
          const name=node.nodes.find(x=>x.type==='word')?.value;
          const replacement=name && semantic(name,context);
          if(replacement){ node.type='word';node.value=replacement;delete node.nodes;changed=true; }
          else if(name && !preservedVariables.test(name) && !stack.includes(name) && defs.has(name)) {
            const next=transform(defs.get(name),context,selector,defs,[...stack,name]);
            if(next.changed){node.type='word';node.value=next.value;delete node.nodes;changed=true;}
          }
          continue;
        }
        if(fn==='rgb'||fn==='rgba') {
          const raw=values.stringify(node.nodes);
          if(!raw.includes('var(')) {
            const parts=raw.match(/[-+]?(?:\d*\.)?\d+%?/g);
            if(parts && parts.length>=3) {
              const c=parts.slice(0,3).map(s=>s.endsWith('%')?parseFloat(s)/100:parseFloat(s)/255);
              c.push(parts[3]?(parts[3].endsWith('%')?parseFloat(parts[3])/100:parseFloat(parts[3])):1);
              node.type='word';node.value=literal(c,context,selector);delete node.nodes;changed=true;continue;
            }
          }
          continue;
        }
        visit(node.nodes);
      } else if(node.type==='word') {
        const c=rgb(node.value.toLowerCase());
        if(c){node.value=literal(c,context,selector);changed=true;}
      }
    }
  }
  visit(tree.nodes);
  return {value:tree.toString(),changed};
}
function compile(css, sourceLabel) {
  const ast=postcss.parse(css);const defs=new Map();
  ast.walkDecls(d=>{if(d.prop.startsWith('--'))defs.set(d.prop,d.value);});
  const out=postcss.root();
  function process(container,target) {
    container.each(node=>{
      if(node.type==='atrule') {
        if(!node.nodes || /keyframes|font-face|page/.test(node.name) || (node.name==='media' && /\bprint\b/.test(node.params))) return;
        const next=postcss.atRule({name:node.name,params:node.params});process(node,next);if(next.nodes?.length)target.append(next);
      }
      if(node.type!=='rule')return;
      const decls=[];
      node.walkDecls(d=>{
        const state=/^--.*(?:state|status)-(?:fg|bg|border|color)/.test(d.prop);
        if(!colorProps.test(d.prop)&&!state)return;
        if(/url\s*\(/i.test(d.value))return; // artwork and its relative URLs stay in the original stylesheet
        if(/brand-media|brand-mark|hub-avatar|dlucca-project-mark|sbw-championship-logo/.test(node.selector))return;
        let context=/background|(?:state|status)-bg/.test(d.prop)?'background':/border|outline|column-rule/.test(d.prop)?'border':'foreground';
        const next=d.prop==='color-scheme'?{value:'dark',changed:d.value!=='dark'}:transform(d.value,context,node.selector,defs);
        if(next.changed)decls.push(postcss.decl({prop:d.prop,value:next.value,important:d.important}));
      });
      if(!decls.length)return;
      const selectors=node.selectors.map(s=>{
        const prefix='html[data-sbw-theme="dark"]';
        if(/^:root\b/.test(s))return s.replace(/^:root\b/,prefix);
        if(/^html\b/.test(s))return s.replace(/^html\b/,prefix);
        return prefix+' '+s;
      });
      const rule=postcss.rule({selector:selectors.join(',\n')});rule.append(decls);target.append(rule);
    });
  }
  process(ast,out);
  return '/* SBW dark color adapter: '+sourceLabel+'. Layout and artwork stay in the source stylesheet. */\n'+out.toString()+'\n';
}

module.exports = { compile };
