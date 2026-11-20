import sys, json, re
F = sys.argv[1]
def rows(stmt):
    i = stmt.index('VALUES') + 6; n = len(stmt)
    while i < n:
        while i < n and stmt[i] != '(':
            i += 1
        if i >= n: break
        i += 1; row = []; cur = None
        while True:
            c = stmt[i]
            if c == "'":
                i += 1; buf = []
                while True:
                    c = stmt[i]
                    if c == '\\':
                        nx = stmt[i+1]; buf.append({'n':'\n','r':'\r','t':'\t','0':'\0'}.get(nx, nx)); i += 2; continue
                    if c == "'":
                        if stmt[i+1] == "'": buf.append("'"); i += 2; continue
                        i += 1; break
                    buf.append(c); i += 1
                cur = ''.join(buf)
            elif c in ',)':
                row.append(cur); cur = None; i += 1
                if c == ')': break
            else:
                j = i
                while stmt[i] not in ',)': i += 1
                v = stmt[j:i].strip(); cur = None if v == 'NULL' else v
        yield row
posts = {}; meta = []
def statements(fh):
    buf=None
    for line in fh:
        if buf is None:
            if line.startswith('INSERT INTO `wp_posts`') or line.startswith('INSERT INTO `wp_postmeta`'): buf=[line]
            else: continue
        else: buf.append(line)
        if line.rstrip().endswith(');'):
            yield ''.join(buf); buf=None
with open(F, encoding='utf8', errors='replace') as fh:
    for st in statements(fh):
        if st.startswith('INSERT INTO `wp_posts`'):
            for r in rows(st): posts[r[0]] = (r[20], r[11], r[5])
        else:
            for r in rows(st): meta.append(r)
want = {'itti-course', 'student-article', 'event', 'post', 'page'}
out = {}
for _, pid, k, v in meta:
    p = posts.get(pid)
    if not p or p[0] not in want or k.startswith('_') or k.startswith('tpg-') or k.startswith('rank_math') or k in ('footnotes',): continue
    out.setdefault(p[0], {}).setdefault(pid, {'slug': p[1], 'fields': {}})['fields'][k] = v
json.dump(out, open(sys.argv[2], 'w'), indent=1, ensure_ascii=False)
print({t: len(v) for t, v in out.items()})
c = out.get('itti-course', {})
for pid, d in list(c.items())[:1]: print(pid, d['slug'], {k: v[:50] for k, v in d['fields'].items()})
