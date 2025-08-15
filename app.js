(()=> {
  const $ = sel => document.querySelector(sel);
  const listEl = $('#list');
  const emptyEl = $('#emptyState');
  const countsEl = $('#counts');
  const live = $('#live');

  const state = {
    tasks: [],
    filters: { search:'', status:'all', priority:'all', sort:'created_desc' }
  };

  const PRIORITY_WEIGHT = { high:3, medium:2, low:1 };

  function uid(){
    return (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-'+Math.random().toString(36).slice(2,9);
  }

  function save(){ localStorage.setItem('todo.tasks', JSON.stringify(state.tasks)); }
  function load(){ try{ state.tasks = JSON.parse(localStorage.getItem('todo.tasks')||'[]'); }catch{ state.tasks = [] } }

  function announce(msg){ live.textContent=''; setTimeout(()=> live.textContent=msg, 10); }

  function addTask(title, due, priority){
    state.tasks.unshift({ id: uid(), title: title.trim(), due: due||'', priority: priority||'medium', done:false, created: Date.now() });
    save(); render(); announce('Task added');
  }

  function deleteTask(id){
    state.tasks = state.tasks.filter(t=>t.id!==id); save(); render(); announce('Task deleted');
  }

  function toggleDone(id){
    const t = state.tasks.find(x=>x.id===id); if(!t) return; t.done=!t.done; save(); render(); announce(t.done?'Completed':'Marked active');
  }

  function updateTitle(id, title){
    const t = state.tasks.find(x=>x.id===id); if(!t) return; t.title = title.trim() || t.title; save(); render(); announce('Task updated');
  }

  function clearCompleted(){ state.tasks = state.tasks.filter(t=>!t.done); save(); render(); announce('Cleared completed tasks'); }

  function reorder(id, beforeId){
    if(id===beforeId) return;
    const idx = state.tasks.findIndex(t=>t.id===id);
    const [item] = state.tasks.splice(idx,1);
    if(beforeId){
      const dest = state.tasks.findIndex(t=>t.id===beforeId);
      state.tasks.splice(dest,0,item);
    } else {
      state.tasks.push(item);
    }
    save(); render();
  }

  function passFilters(t){
    const s = state.filters;
    if(s.status==='active' && t.done) return false;
    if(s.status==='completed' && !t.done) return false;
    if(s.priority!=='all' && t.priority!==s.priority) return false;
    if(s.search && !t.title.toLowerCase().includes(s.search)) return false;
    return true;
  }

  function sortTasks(arr){
    const s = state.filters.sort;
    const copy = [...arr];
    switch(s){
      case 'created_asc': return copy.sort((a,b)=>a.created-b.created);
      case 'created_desc': return copy.sort((a,b)=>b.created-a.created);
      case 'due_asc': return copy.sort((a,b)=> (a.due||'9999-12-31').localeCompare(b.due||'9999-12-31'));
      case 'due_desc': return copy.sort((a,b)=> (b.due||'0000-01-01').localeCompare(a.due||'0000-01-01'));
      case 'priority_desc': return copy.sort((a,b)=> PRIORITY_WEIGHT[b.priority]-PRIORITY_WEIGHT[a.priority]);
      case 'priority_asc': return copy.sort((a,b)=> PRIORITY_WEIGHT[a.priority]-PRIORITY_WEIGHT[b.priority]);
      case 'title_asc': return copy.sort((a,b)=> a.title.localeCompare(b.title));
      case 'title_desc': return copy.sort((a,b)=> b.title.localeCompare(a.title));
      default: return copy;
    }
  }

  function fmtDate(d){ if(!d) return 'No due date'; const x = new Date(d+'T00:00:00'); return x.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }); }

  function render(){
    const filtered = sortTasks(state.tasks.filter(passFilters));
    listEl.innerHTML='';
    if(filtered.length===0){ emptyEl.style.display='block'; } else { emptyEl.style.display='none'; }

    filtered.forEach(t=>{
      const li = document.createElement('li');
      li.className='task';
      li.dataset.id = t.id;
      li.draggable = true;

      const box = document.createElement('div');
      box.className = 'checkbox'+(t.done?' checked':'');
      box.role='checkbox'; box.tabIndex=0; box.setAttribute('aria-checked', t.done);
      box.innerHTML = t.done ? '✓' : '';
      box.addEventListener('click', ()=> toggleDone(t.id));
      box.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); toggleDone(t.id);} });

      const content = document.createElement('div'); content.className='content';
      const title = document.createElement('div'); title.className='title'+(t.done?' done':''); title.textContent=t.title; title.setAttribute('title','Double-click to edit');
      title.addEventListener('dblclick', ()=>{ title.contentEditable = 'true'; title.focus(); selectAll(title); });
      title.addEventListener('blur', ()=>{ if(title.isContentEditable){ title.contentEditable='false'; updateTitle(t.id, title.textContent) } });
      title.addEventListener('keydown', (e)=>{ if(!title.isContentEditable) return; if(e.key==='Enter'){ e.preventDefault(); title.blur(); } if(e.key==='Escape'){ e.preventDefault(); title.textContent = t.title; title.blur(); } });

      const meta = document.createElement('div'); meta.className='meta';
      const due = document.createElement('span'); due.className='badge'; due.textContent = fmtDate(t.due);
      const pr = document.createElement('span'); pr.className='badge '+t.priority; pr.textContent = t.priority.charAt(0).toUpperCase()+t.priority.slice(1);
      meta.append(due, pr);

      content.append(title, meta);

      const actions = document.createElement('div'); actions.className='actions';
      const editBtn = iconButton('✎','Edit', ()=>{ title.dispatchEvent(new Event('dblclick')); });
      const delBtn = iconButton('🗑️','Delete', ()=> deleteTask(t.id));
      actions.append(editBtn, delBtn);

      li.append(box, content, actions);

      li.addEventListener('dragstart', (e)=>{ li.classList.add('dragging'); e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed='move'; });
      li.addEventListener('dragend', ()=> li.classList.remove('dragging'));
      li.addEventListener('dragover', (e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; });
      li.addEventListener('drop', (e)=>{ e.preventDefault(); const dragId = e.dataTransfer.getData('text/plain'); const beforeId = t.id; reorder(dragId, beforeId); });

      listEl.append(li);
    });

    const total = state.tasks.length;
    const completed = state.tasks.filter(t=>t.done).length;
    const active = total - completed;
    countsEl.textContent = `${total} total • ${active} active • ${completed} completed`;
  }

  function iconButton(txt, label, onClick){
    const b = document.createElement('button');
    b.className='iconbtn'; b.type='button'; b.setAttribute('aria-label', label); b.textContent=txt; b.addEventListener('click', onClick); return b;
  }

  function selectAll(el){
    const range = document.createRange(); range.selectNodeContents(el); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  }

  $('#addForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const title = $('#taskInput').value;
    if(!title.trim()) return;
    const due = $('#dueInput').value; const priority = $('#priorityInput').value;
    addTask(title, due, priority);
    e.target.reset(); $('#taskInput').focus();
  });

  $('#search').addEventListener('input', (e)=>{ state.filters.search = e.target.value.trim().toLowerCase(); render(); });
  $('#statusFilter').addEventListener('change', (e)=>{ state.filters.status = e.target.value; render(); });
  $('#priorityFilter').addEventListener('change', (e)=>{ state.filters.priority = e.target.value; render(); });
  $('#sortBy').addEventListener('change', (e)=>{ state.filters.sort = e.target.value; render(); });
  $('#clearCompleted').addEventListener('click', clearCompleted);

  $('#exportBtn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(state.tasks, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'todo-tasks.json'; a.click(); URL.revokeObjectURL(a.href);
  });
  $('#importFile').addEventListener('change', async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    try{ const text = await file.text(); const data = JSON.parse(text); if(Array.isArray(data)){ state.tasks = data; save(); render(); announce('Tasks imported'); } }
    catch(err){ alert('Invalid file. Could not import.'); console.error(err); }
    finally{ e.target.value=''; }
  });

  const themeKey = 'todo.theme';
  function setTheme(mode){ document.documentElement.dataset.theme = mode; localStorage.setItem(themeKey, mode); }
  function toggleTheme(){ const cur = localStorage.getItem(themeKey)||'auto'; const next = cur==='dark' ? 'light' : cur==='light' ? 'auto' : 'dark'; setTheme(next); updateThemeBtn(); }
  function updateThemeBtn(){ const cur = localStorage.getItem(themeKey)||'auto'; const b = $('#themeToggle'); b.textContent = (cur==='dark'?'🌙 Dark':cur==='light'?'☀️ Light':'🌓 Auto') + ' Theme'; b.setAttribute('aria-pressed', cur==='dark'); }
  $('#themeToggle').addEventListener('click', toggleTheme);

  const savedTheme = localStorage.getItem(themeKey);
  if(savedTheme) setTheme(savedTheme);
  updateThemeBtn();

  load(); render();

  listEl.addEventListener('keydown', (e)=>{
    const li = e.target.closest('li.task');
    if(!li) return;
    if(e.key==='Delete'){ deleteTask(li.dataset.id); }
  });
})();
