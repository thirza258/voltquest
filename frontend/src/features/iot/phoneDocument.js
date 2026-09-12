/** Limit the phone to the simulated server; no request should leave the learning environment. */
export function virtualRequest(raw, basePath = '/') {
  const url = new URL(raw || '/', `http://192.168.4.1${basePath}`)
  if (url.origin !== 'http://192.168.4.1') throw new Error('Use a path on the virtual server, such as /on.')
  return `${url.pathname}${url.search}`
}

/** Render server HTML in an opaque sandbox. Only our navigation bridge executes. */
export function phoneDocument(body, contentType, channel) {
  const doc = new DOMParser().parseFromString(contentType?.includes('html') ? String(body) : '', 'text/html')
  if (!contentType?.includes('html')) { const pre = doc.createElement('pre'); pre.textContent = String(body); doc.body.append(pre) }
  doc.querySelectorAll('script,iframe,frame,frameset,object,embed,base,meta,link,svg,math').forEach(el => el.remove())
  doc.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name) || ['srcdoc', 'formaction', 'target', 'download', 'srcset'].includes(attr.name)) el.removeAttribute(attr.name)
      else if (['href', 'src', 'action'].includes(attr.name) && /^\s*(javascript|data|vbscript):/i.test(attr.value)) el.removeAttribute(attr.name)
    }
  })
  const bridge = `
    const send = (request) => parent.postMessage({type:'voltquest-phone',channel:${JSON.stringify(channel)},request},'*');
    document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link)return;event.preventDefault();send({method:'GET',path:link.getAttribute('href')});});
    document.addEventListener('submit',event=>{event.preventDefault();const form=event.target;const method=(form.getAttribute('method')||'GET').toUpperCase();const params=new URLSearchParams(new FormData(form));let path=form.getAttribute('action')||'';if(method==='GET')path+=(path.includes('?')?'&':'?')+params;send({method,path,body:method==='POST'?params.toString():undefined,headers:{'Content-Type':'application/x-www-form-urlencoded'}});});
  `
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'"><style>body{font:14px system-ui,sans-serif;color:#0f172a;padding:16px;overflow-wrap:anywhere}a,button{display:inline-block;padding:8px;color:#0f766e}input{max-width:100%}pre{white-space:pre-wrap}</style>${doc.head.innerHTML}</head><body>${doc.body.innerHTML}<script>${bridge}</script></body></html>`
}
