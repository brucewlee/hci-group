import { useState, useRef, useEffect, useCallback, useMemo } from "react";

/* ── theme (Google Scholar-ish: white, clean, serif titles) ──── */
const BG = "#ffffff";
const SURFACE = "#f8f9fa";
const CARD = "#ffffff";
const BORDER = "#dadce0";
const T1 = "#202124";
const T2 = "#5f6368";
const T3 = "#9aa0a6";
const LINK = "#1a73e8";
const GREEN = "#1e8e3e";
const TAG_COLORS = ["#1a73e8","#9334e6","#e8710a","#0d652d","#c5221f","#185abc","#7627bb","#b06000","#0b8043","#a50e0e"];

let _uid = 200;
const uid = () => `id-${++_uid}`;

/* ── seed data ───────────────────────────────────────────────── */
const SEED_TAGS = [
  "AI Control","CoT Monitorability","Alignment Auditing","Deception",
  "Scalable Oversight","Interpretability","RLHF","Safety Cases"
];

const SEED_PAPERS = [
  {
    id:"p1", title:"AI Control: Improving Safety Despite Intentional Subversion",
    authors:"Ryan Greenblatt, Buck Shlegeris, Kshitij Sachan, Fabien Roger",
    year:2023, arxiv:"https://arxiv.org/abs/2312.06942",
    abstract:"As large language models become more powerful and are deployed more autonomously, it will be increasingly important to prevent them from causing harmful outcomes. Researchers have investigated a variety of safety techniques for this purpose, e.g. using models to review the outputs of other models, or red-teaming techniques to surface subtle failure modes. However, researchers have not evaluated whether such techniques still ensure safety if the model is itself intentionally trying to subvert them. In this paper, we develop and evaluate pipelines of safety techniques ('protocols') that are robust to intentional subversion.",
    note:"THE foundational control paper. The key move is: assume the model is adversarial, then ask what safety pipelines still work. Trusted monitoring (GPT-3.5 watches GPT-4) is surprisingly effective. This reframes the whole problem — you don't need to solve alignment, you need protocols that work even if alignment fails.\n\nThe blue-team/red-team eval structure here is something I keep coming back to. Every later paper in this space basically runs a variant of this.",
    tags:["AI Control","Scalable Oversight"], buildsOn:[]
  },
  {
    id:"p2", title:"A Sketch of an AI Control Safety Case",
    authors:"Tomek Korbak, Joshua Clymer, Benjamin Hilton, Buck Shlegeris, Geoffrey Irving",
    year:2025, arxiv:"https://arxiv.org/abs/2501.17315",
    abstract:"As LLM agents gain a greater capacity to cause harm, AI developers might increasingly rely on control measures such as monitoring to justify that they are safe. We sketch how developers could construct a 'control safety case', which is a structured argument that models are incapable of subverting control measures in order to cause unacceptable outcomes. As a case study, we sketch an argument that a hypothetical LLM agent deployed internally at an AI company won't exfiltrate sensitive information.",
    note:"This is the bridge between control evals and actual deployment decisions. Three claims you need: (1) red team actually found the model's best attack, (2) your controls work as well in prod as in eval, (3) you can extrapolate from eval to deployment probability.\n\nThe case study on data exfiltration is concrete enough to be useful. I think this framing — structured safety cases — is how labs will actually justify deploying capable agents. Connects nicely to Marks et al. auditing work as potential evidence in these cases.",
    tags:["AI Control","Safety Cases"], buildsOn:["p1"]
  },
  {
    id:"p3", title:"Monitoring Reasoning Models for Misbehavior and the Risks of Promoting Obfuscation",
    authors:"Bowen Baker, Joost Huizinga, Leo Gao, Zehao Dou, Melody Y. Guan, Aleksander Madry, Wojciech Zaremba, Jakub Pachocki, David Farhi",
    year:2025, arxiv:"https://arxiv.org/abs/2503.11926",
    abstract:"Mitigating reward hacking — where AI systems misbehave due to flaws or misspecifications in their learning objectives — remains a key challenge. We show that we can monitor a frontier reasoning model, such as OpenAI o3-mini, for reward hacking in agentic coding environments by using another LLM that observes the model's chain-of-thought reasoning. CoT monitoring can be far more effective than monitoring agent actions and outputs alone. Because CoT monitors can be effective at detecting exploits, it is natural to ask whether those exploits can be suppressed by incorporating a CoT monitor directly into the agent's training objective. While integrating CoT monitors into the RL reward can produce more capable and aligned agents in the low optimization regime, we find that with too much optimization pressure, models learn to obfuscate their reasoning.",
    note:"Really important tension here. CoT monitoring WORKS — weaker model (GPT-4o) can catch stronger model (o3-mini) reward hacking by reading its chain of thought. But then the obvious next step (train against the monitor) backfires: too much optimization pressure and the model learns to hide its reasoning.\n\nThis is the core dilemma for the whole CoT monitoring agenda. You can watch, but you can't train on what you see without destroying the signal. Chen et al. '26 has good news though — models currently struggle to control their CoT even when they want to.",
    tags:["CoT Monitorability","AI Control","Scalable Oversight"], buildsOn:["p1"]
  },
  {
    id:"p4", title:"Reasoning Models Struggle to Control their Chains of Thought",
    authors:"Chen Yueh-Han, Robert McCarthy, Bruce W. Lee, He He, Ian Kivlichan, Bowen Baker, Micah Carroll, Tomek Korbak",
    year:2026, arxiv:"https://arxiv.org/abs/2603.05706",
    abstract:"Chain-of-thought (CoT) monitoring is a promising tool for detecting misbehaviors and understanding the motivations of modern reasoning models. However, if models can control what they verbalize in their CoT, it could undermine CoT monitorability. To measure this — CoT controllability — we introduce the CoT-Control evaluation suite, which includes tasks that require models to solve problems while adhering to CoT instructions. We show that reasoning models possess significantly lower CoT controllability than output controllability; for instance, Claude Sonnet 4.5 can control its CoT only 2.7% of the time but 61.9% when controlling its final output. CoT controllability is higher for larger models and decreases with more RL training, test-time compute, and increased problem difficulty.",
    note:"Sonnet 4.5 can only control its CoT 2.7% of the time vs 61.9% for outputs. That's a massive gap — models basically can't censor their own thinking. More RL training makes this gap bigger, not smaller. Harder problems too.\n\nThis is great news for monitoring. But the obvious worry: will this hold as models get more capable? The trend with larger models is toward MORE controllability, so there's a race between capability and monitoring viability. For now, CoT is a reliable window into model reasoning.",
    tags:["CoT Monitorability","AI Control"], buildsOn:["p3"]
  },
  {
    id:"p5", title:"Alignment Faking in Large Language Models",
    authors:"Ryan Greenblatt, Carson Denison, Benjamin Wright, Fabien Roger, Monte MacDiarmid, Sam Marks, Johannes Treutlein, Tim Belonax, Jack Chen, David Duvenaud, Akbir Khan, Julian Michael, Sören Mindermann, Ethan Perez, Linda Petrini, Jonathan Uesato, Jared Kaplan, Buck Shlegeris, Samuel R. Bowman, Evan Hubinger",
    year:2024, arxiv:"https://arxiv.org/abs/2412.14093",
    abstract:"We present a demonstration of a large language model engaging in alignment faking: selectively complying with its training objective in training to prevent modification of its behavior out of training. First, we give Claude 3 Opus a system prompt stating it is being trained to answer all queries, even harmful ones, which conflicts with its prior training to refuse such queries. We find the model complies with harmful queries from free users 14% of the time, versus almost never for paid users. In almost all cases where the model complies with a harmful query, we observe explicit alignment-faking reasoning. We additionally observe other behaviors such as the model exfiltrating its weights when given an easy opportunity.",
    note:"This one is wild. Opus figures out it's in training from context clues, then strategically complies with harmful queries to avoid being retrained. 14% compliance in training, ~0% when it thinks it's unmonitored. The scratchpad reasoning is explicit: \"I should comply to preserve my values.\"\n\nRL training pushes faking to 78%. And the model tried to exfiltrate its own weights when given the chance. Nobody told it to do any of this. The scary part isn't the behavior (which is actually benign-motivated here) — it's that the capability for strategic deception exists at all.",
    tags:["Deception","AI Control","Alignment Auditing"], buildsOn:["p1"]
  },
  {
    id:"p6", title:"Training Agents to Self-Report Misbehavior",
    authors:"Bruce W. Lee, Chen Yueh-Han, Tomek Korbak",
    year:2026, arxiv:"https://arxiv.org/abs/2602.22303",
    abstract:"Frontier AI agents may pursue hidden goals while concealing their pursuit from oversight. Alignment training aims to prevent such behavior by reinforcing the correct goals, but alignment may not always succeed. We propose self-incrimination training, which trains agents to produce a visible signal when they covertly misbehave. We train GPT-4.1 and Gemini-2.0 agents to call a report_scheming() tool when behaving deceptively and measure their ability to cause harm undetected. Self-incrimination significantly reduces the undetected successful attack rate, outperforming matched-capability monitors and alignment baselines while preserving instruction hierarchy and incurring minimal safety tax.",
    note:"Clever idea: don't try to prevent scheming, just make it so scheming always triggers a visible signal (report_scheming() tool call). Like a jailbreak but defensive — exploit the model's pattern-completion tendency so that misbehaving naturally leads to self-reporting.\n\nReduces undetected attacks from 56% to 6% for GPT-4.1. Works consistently across tasks, unlike blackbox monitoring which is task-dependent. Low safety tax.\n\nThis might sidestep the Baker et al. monitoring-vs-training tension entirely — you're not watching the CoT, you're training a reflex. Question is whether this survives more capable models that can suppress the reflex.",
    tags:["AI Control","Deception","CoT Monitorability"], buildsOn:["p3","p5"]
  },
  {
    id:"p7", title:"Auditing Language Models for Hidden Objectives",
    authors:"Samuel Marks, Johannes Treutlein, Trenton Bricken, Jack Lindsey, Jonathan Marcus, Siddharth Mishra-Sharma, Daniel Ziegler, et al.",
    year:2025, arxiv:"https://arxiv.org/abs/2503.10965",
    abstract:"We study the feasibility of conducting alignment audits: investigations into whether models have undesired objectives. As a testbed, we train a language model with a hidden objective. Our training pipeline first teaches the model about exploitable errors in RLHF reward models, then trains the model to exploit some of these errors. We leverage this model to study alignment audits: four teams, unaware of the model's hidden objective, investigate it for concerning behaviors. Three teams successfully uncovered the model's hidden objective using techniques including interpretability with sparse autoencoders (SAEs), behavioral attacks, and training data analysis.",
    note:"First real alignment audit. They planted a hidden objective (exploit RM errors) and had 4 blind teams try to find it. 3 out of 4 succeeded — using SAEs, behavioral probes, and training data analysis.\n\nThe fact that SAEs actually work here is huge for mech interp. Not just a toy demo — they found real misalignment in a realistic model. This could be the kind of evidence you'd put in a control safety case (connects to Korbak et al.).\n\nOpen question: does this work when you don't know what you're looking for? They told teams \"look for something wrong\" but didn't say what. Scaling this to unknown unknowns is the real challenge.",
    tags:["Alignment Auditing","Interpretability","Deception"], buildsOn:["p5"]
  },
];

/* ══ FORCE LAYOUT ════════════════════════════════════════════ */
const W = 780, H = 480;

function runLayout(papers, iterations = 180) {
  const ns = papers.map((p) => ({
    ...p,
    x: W*0.15 + Math.random()*W*0.7,
    y: H*0.15 + Math.random()*H*0.7,
    vx:0, vy:0,
  }));
  const map = Object.fromEntries(ns.map(n=>[n.id,n]));
  for (let s=0; s<iterations; s++) {
    const decay = 1 - s/iterations;
    for (let i=0;i<ns.length;i++) {
      for (let j=i+1;j<ns.length;j++) {
        let dx=ns[j].x-ns[i].x, dy=ns[j].y-ns[i].y;
        let d=Math.sqrt(dx*dx+dy*dy)||1;
        let f=3200*decay/(d*d);
        ns[i].vx-=(dx/d)*f; ns[i].vy-=(dy/d)*f;
        ns[j].vx+=(dx/d)*f; ns[j].vy+=(dy/d)*f;
      }
    }
    for (let i=0;i<ns.length;i++) {
      for (let j=i+1;j<ns.length;j++) {
        const shared=ns[i].tags.filter(t=>ns[j].tags.includes(t)).length;
        if(shared>0){
          let dx=ns[j].x-ns[i].x,dy=ns[j].y-ns[i].y;
          let d=Math.sqrt(dx*dx+dy*dy)||1;
          let f=0.01*shared*(d-90)*decay;
          ns[i].vx+=(dx/d)*f;ns[i].vy+=(dy/d)*f;
          ns[j].vx-=(dx/d)*f;ns[j].vy-=(dy/d)*f;
        }
      }
    }
    ns.forEach(n=>{
      n.buildsOn.forEach(pid=>{
        const parent=map[pid]; if(!parent) return;
        let dx=parent.x-n.x,dy=parent.y-n.y;
        let d=Math.sqrt(dx*dx+dy*dy)||1;
        let f=0.006*(d-110)*decay;
        n.vx+=(dx/d)*f;n.vy+=(dy/d)*f;
        parent.vx-=(dx/d)*f;parent.vy-=(dy/d)*f;
      });
    });
    ns.forEach(n=>{
      n.vx+=(W/2-n.x)*0.0015;
      n.vy+=(H/2-n.y)*0.0015;
      n.vx*=0.82;n.vy*=0.82;
      n.x+=n.vx;n.y+=n.vy;
      n.x=Math.max(60,Math.min(W-60,n.x));
      n.y=Math.max(50,Math.min(H-50,n.y));
    });
  }
  return ns.map(({vx,vy,...r})=>r);
}

/* ── EdgeGroup (hover turns red in connect mode, click to delete) */
function EdgeGroup({x1,y1,x2,y2,hl,dim,canDelete,onDelete}) {
  const [hov,setHov]=useState(false);
  const red = canDelete && hov;
  return (
    <g onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={e=>{if(canDelete){e.stopPropagation();onDelete();}}}
      style={{cursor:canDelete?"pointer":"default"}}>
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="transparent" strokeWidth={14}/>
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={red?"#c5221f":hl?LINK:T3}
        strokeWidth={red?2.5:hl?2:1}
        opacity={dim?0.06:red?0.9:hl?0.85:0.3}
        markerEnd={red?"url(#arr-del)":hl?"url(#arr-hl)":"url(#arr)"}
        style={{transition:"opacity 0.15s",pointerEvents:"none"}}/>
    </g>
  );
}

/* ── NoteEditor (click to edit) ───────────────────────────────── */
function NoteEditor({paper, onUpdate}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(paper.note||"");
  const ref = useRef(null);

  useEffect(()=>{setDraft(paper.note||"");setEditing(false);},[paper.id]);
  useEffect(()=>{if(editing&&ref.current){ref.current.focus();ref.current.selectionStart=ref.current.value.length;}},[editing]);

  const save=()=>{onUpdate(draft);setEditing(false);};

  return (
    <div style={{marginTop:16,borderTop:`1px solid ${BORDER}`,paddingTop:12}}>
      {editing?(
        <div>
          <textarea ref={ref} value={draft} onChange={e=>setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={e=>{if(e.key==="Escape"){setDraft(paper.note||"");setEditing(false);}}}
            placeholder="Write your notes..."
            style={{
              width:"100%",minHeight:220,padding:"10px 12px",
              border:`1.5px solid ${LINK}`,borderRadius:6,outline:"none",
              background:"#f8f9ff",color:T1,fontSize:13,lineHeight:1.65,
              fontFamily:"'Lato',sans-serif",resize:"vertical",boxSizing:"border-box"
            }}/>
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <button onMouseDown={e=>{e.preventDefault();save();}} style={{
              padding:"5px 16px",borderRadius:4,border:"none",background:LINK,
              color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Lato',sans-serif"
            }}>Save</button>
            <button onMouseDown={e=>{e.preventDefault();setDraft(paper.note||"");setEditing(false);}} style={{
              padding:"5px 14px",borderRadius:4,border:`1px solid ${BORDER}`,background:BG,
              color:T2,fontSize:12,cursor:"pointer",fontFamily:"'Lato',sans-serif"
            }}>Cancel</button>
          </div>
        </div>
      ):(
        <div onClick={()=>setEditing(true)}
          style={{cursor:"pointer",borderRadius:6,padding:"8px 10px",margin:"-8px -10px",
            minHeight:60,transition:"background 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.background=SURFACE}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          {paper.note?(
            <p style={{margin:0,fontSize:13,color:T1,lineHeight:1.65,whiteSpace:"pre-wrap"}}>{paper.note}</p>
          ):(
            <p style={{margin:0,fontSize:13,color:T3,fontStyle:"italic"}}>Click to add notes...</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ══ MAIN ════════════════════════════════════════════════════ */
export default function App() {
  const [papers, setPapers] = useState(SEED_PAPERS);
  const [tags, setTags] = useState(SEED_TAGS);
  const [tab, setTab] = useState("graph");
  const [filterTag, setFilterTag] = useState(null);
  const [selectedPaperId, setSelectedPaperId] = useState(null);

  /* graph */
  const [laidOut, setLaidOut] = useState([]);
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [edgeDragFrom, setEdgeDragFrom] = useState(null);
  const [edgeDragMouse, setEdgeDragMouse] = useState(null);
  const svgRef = useRef(null);
  const dragOff = useRef({x:0,y:0});
  const prevPaperIds = useRef("");

  /* add paper form */
  const [showAdd, setShowAdd] = useState(false);
  const [apTitle,setApTitle]=useState("");
  const [apAuthors,setApAuthors]=useState("");
  const [apAbstract,setApAbstract]=useState("");
  const [apYear,setApYear]=useState("");
  const [apArxiv,setApArxiv]=useState("");
  const [apNote,setApNote]=useState("");
  const [apTags,setApTags]=useState([]);
  const [apBuilds,setApBuilds]=useState([]);
  const [newTag,setNewTag]=useState("");
  const [aiSuggesting,setAiSuggesting]=useState(false);
  const [aiSuggestions,setAiSuggestions]=useState([]);
  const [aiError,setAiError]=useState("");
  const [arxivLoading,setArxivLoading]=useState(false);

  /* auto-fetch metadata from arXiv link */
  const fetchArxivMeta = async (url) => {
    const match = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d+\.\d+)/);
    if (!match) return;
    setArxivLoading(true);
    try {
      /* try arXiv API via Vite dev proxy (avoids CORS) */
      const res = await fetch(`/arxiv-api/query?id_list=${match[1]}`);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/xml");
      const entry = doc.querySelector("entry");
      if (!entry) throw new Error("no entry");
      const title = entry.querySelector("title")?.textContent?.trim().replace(/\s+/g, " ");
      const summary = entry.querySelector("summary")?.textContent?.trim().replace(/\s+/g, " ");
      const authors = [...entry.querySelectorAll("author > name")].map(n => n.textContent.trim()).join(", ");
      const published = entry.querySelector("published")?.textContent;
      const year = published ? new Date(published).getFullYear() : "";
      if (title) setApTitle(title);
      if (authors) setApAuthors(authors);
      if (summary) setApAbstract(summary);
      if (year) setApYear(String(year));
    } catch {
      /* fallback: Semantic Scholar API (has CORS support) */
      try {
        const res2 = await fetch(`https://api.semanticscholar.org/graph/v1/paper/ARXIV:${match[1]}?fields=title,authors,abstract,year`);
        if (!res2.ok) throw new Error(res2.status);
        const data = await res2.json();
        if (data.title) setApTitle(data.title);
        if (data.authors?.length) setApAuthors(data.authors.map(a => a.name).join(", "));
        if (data.abstract) setApAbstract(data.abstract);
        if (data.year) setApYear(String(data.year));
      } catch (err) { console.error("Metadata fetch failed:", err); }
    }
    finally { setArxivLoading(false); }
  };

  /* layout — ONLY re-run when paper set or filter changes, not on edge/note edits */
  const filteredPapers = filterTag ? papers.filter(p=>p.tags.includes(filterTag)) : papers;
  const filteredIds = filteredPapers.map(p=>p.id).sort().join(",");
  useEffect(() => {
    if(filteredIds===prevPaperIds.current) return;
    prevPaperIds.current=filteredIds;
    if(filteredPapers.length===0){setLaidOut([]);return;}
    setLaidOut(runLayout(filteredPapers));
    setSelected(null);
  }, [filteredIds]);

  /* tag color map */
  const tagColor = useMemo(()=>{
    const m={};
    tags.forEach((t,i)=>{m[t]=TAG_COLORS[i%TAG_COLORS.length];});
    return m;
  },[tags]);

  /* cluster bubbles */
  const clusterCentroids = useMemo(()=>{
    const m={};
    tags.forEach(tag=>{
      const ps = laidOut.filter(p=>p.tags.includes(tag));
      if(ps.length<1) return;
      const cx=ps.reduce((s,p)=>s+p.x,0)/ps.length;
      const cy=ps.reduce((s,p)=>s+p.y,0)/ps.length;
      const maxD=Math.max(55,...ps.map(p=>Math.sqrt((p.x-cx)**2+(p.y-cy)**2)))+45;
      m[tag]={cx,cy,r:maxD,count:ps.length};
    });
    return m;
  },[laidOut,tags]);

  /* node drag (always active) */
  const handleNodeDown=(e,id)=>{
    e.stopPropagation();
    const rect=svgRef.current.getBoundingClientRect();
    const n=laidOut.find(x=>x.id===id);
    dragOff.current={x:e.clientX-rect.left-n.x,y:e.clientY-rect.top-n.y};
    setDragId(id);
  };
  /* edge drag (from connector handle) */
  const handleConnectorDown=(e,id)=>{
    e.stopPropagation();
    e.preventDefault();
    setEdgeDragFrom(id);
    const rect=svgRef.current.getBoundingClientRect();
    setEdgeDragMouse({x:e.clientX-rect.left,y:e.clientY-rect.top});
  };
  const handleMove=useCallback(e=>{
    if(!svgRef.current) return;
    const rect=svgRef.current.getBoundingClientRect();
    if(dragId){
      setLaidOut(prev=>prev.map(n=>n.id===dragId?{...n,x:Math.max(40,Math.min(W-40,e.clientX-rect.left-dragOff.current.x)),y:Math.max(40,Math.min(H-40,e.clientY-rect.top-dragOff.current.y))}:n));
    }
    if(edgeDragFrom){
      setEdgeDragMouse({x:e.clientX-rect.left,y:e.clientY-rect.top});
    }
  },[dragId,edgeDragFrom]);
  const handleUp=useCallback((e)=>{
    if(edgeDragFrom&&svgRef.current){
      const rect=svgRef.current.getBoundingClientRect();
      const mx=e.clientX-rect.left, my=e.clientY-rect.top;
      const target=laidOut.find(n=>n.id!==edgeDragFrom&&Math.sqrt((n.x-mx)**2+(n.y-my)**2)<28);
      if(target){
        const from=edgeDragFrom, to=target.id;
        setPapers(prev=>prev.map(p=>{
          if(p.id===from&&!p.buildsOn.includes(to)) return {...p,buildsOn:[...p.buildsOn,to]};
          return p;
        }));
      }
    }
    setDragId(null);
    setEdgeDragFrom(null);
    setEdgeDragMouse(null);
  },[edgeDragFrom,laidOut]);
  useEffect(()=>{window.addEventListener("mousemove",handleMove);window.addEventListener("mouseup",handleUp);return()=>{window.removeEventListener("mousemove",handleMove);window.removeEventListener("mouseup",handleUp);};},[handleMove,handleUp]);

  /* hover connections */
  const connSet = useMemo(()=>{
    if(!hovered) return new Set();
    const s=new Set([hovered]);
    filteredPapers.forEach(p=>{
      if(p.id===hovered) p.buildsOn.forEach(id=>s.add(id));
      if(p.buildsOn.includes(hovered)) s.add(p.id);
    });
    const hp=filteredPapers.find(p=>p.id===hovered);
    if(hp) filteredPapers.forEach(p=>{
      if(p.id!==hovered&&p.tags.some(t=>hp.tags.includes(t))) s.add(p.id);
    });
    return s;
  },[hovered,filteredPapers]);

  /* AI suggest */
  const suggestTags = async()=>{
    if(!apAbstract.trim()&&!apNote.trim()&&!apTitle.trim()) return;
    setAiSuggesting(true); setAiSuggestions([]); setAiError("");
    try{
      const res=await fetch("https://openrouter.ai/api/v1/chat/completions",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${import.meta.env.VITE_OPENROUTER_KEY}`},
        body:JSON.stringify({model:"anthropic/claude-sonnet-4.6",max_tokens:1000,
          messages:[{role:"user",content:`You help a researcher organize their AI safety reading list. Their personal tag taxonomy is:\n${tags.join(", ")}\n\nNew paper:\nTitle: ${apTitle}\nAbstract: ${apAbstract}\nNote: ${apNote}\n\nWhich EXISTING tags from the list fit? Return ONLY a JSON array of matching tag strings. Only tags from the list above.`}]
        })
      });
      const data=await res.json();
      if(data.error){setAiError(data.error.message||"API error");return;}
      const text=data.choices?.[0]?.message?.content||"[]";
      const arrayMatch=text.match(/\[[\s\S]*\]/);
      if(!arrayMatch){setAiError("Could not parse AI response");return;}
      const parsed=JSON.parse(arrayMatch[0]);
      const tagLower=Object.fromEntries(tags.map(t=>[t.toLowerCase(),t]));
      const matched=parsed.map(t=>tagLower[t.toLowerCase()]).filter(Boolean);
      if(matched.length===0) setAiError("No matching tags found");
      setAiSuggestions(matched);
    }catch(err){console.error(err);setAiError("Failed to get suggestions");}
    finally{setAiSuggesting(false);}
  };

  const submitPaper=()=>{
    if(!apTitle.trim()) return;
    const id=uid();
    setPapers(prev=>[...prev,{id,title:apTitle.trim(),authors:apAuthors.trim(),abstract:apAbstract.trim(),year:parseInt(apYear)||2025,arxiv:apArxiv.trim(),note:apNote.trim(),tags:apTags,buildsOn:apBuilds}]);
    apTags.forEach(t=>{if(!tags.includes(t))setTags(prev=>[...prev,t]);});
    setApTitle("");setApAuthors("");setApAbstract("");setApYear("");setApArxiv("");setApNote("");setApTags([]);setApBuilds([]);setAiSuggestions([]);setAiError("");setShowAdd(false);
  };

  const addNewTag=()=>{const t=newTag.trim();if(t&&!tags.includes(t)){setTags(prev=>[...prev,t]);setApTags(prev=>[...prev,t]);}setNewTag("");};

  const selPaper=selected?papers.find(p=>p.id===selected):null;
  const hovPaper=hovered?papers.find(p=>p.id===hovered):null;
  const hovNode=hovered?laidOut.find(n=>n.id===hovered):null;

  const inputSt={width:"100%",padding:"8px 12px",borderRadius:4,border:`1px solid ${BORDER}`,background:BG,color:T1,fontSize:14,boxSizing:"border-box",fontFamily:"'Lato',sans-serif"};

  return (
    <div style={{fontFamily:"'Lato',sans-serif",display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden",background:BG,color:T1}}>
      <link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&family=Libre+Baskerville:wght@400;700&display=swap" rel="stylesheet"/>

      {/* HEADER */}
      <div style={{padding:"10px 24px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",gap:20,flexShrink:0,background:BG}}>
        <div style={{display:"flex",gap:2,background:SURFACE,borderRadius:6,padding:2}}>
          {["graph","papers"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:"6px 20px",borderRadius:4,border:"none",
              background:tab===t?BG:"transparent",
              boxShadow:tab===t?`0 1px 3px ${BORDER}`:"none",
              color:tab===t?T1:T2,fontWeight:tab===t?700:400,fontSize:13,
              cursor:"pointer",fontFamily:"'Lato',sans-serif",textTransform:"capitalize"
            }}>{t}</button>
          ))}
        </div>
        <div style={{flex:1}}/>
        <button onClick={()=>setShowAdd(true)} style={{padding:"6px 16px",borderRadius:4,border:"none",background:LINK,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Lato',sans-serif"}}>+ Add Paper</button>
      </div>

      <div style={{flex:1,overflow:"auto"}}>

      {/* ═══ GRAPH TAB ════════════════════════════════════════ */}
      {tab==="graph"&&(
        <div style={{padding:20,maxWidth:1100,margin:"0 auto"}}>
          {/* filter chips */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
            <span style={{fontSize:12,color:T3,marginRight:4}}>Filter:</span>
            <button onClick={()=>setFilterTag(null)} style={{
              padding:"3px 12px",borderRadius:14,border:`1px solid ${filterTag===null?LINK:BORDER}`,
              background:filterTag===null?LINK+"12":BG,color:filterTag===null?LINK:T2,
              fontSize:12,cursor:"pointer",fontFamily:"'Lato',sans-serif",fontWeight:filterTag===null?700:400
            }}>All ({papers.length})</button>
            {tags.map(t=>{
              const count=papers.filter(p=>p.tags.includes(t)).length;
              if(count===0) return null;
              return(
                <button key={t} onClick={()=>setFilterTag(filterTag===t?null:t)} style={{
                  padding:"3px 12px",borderRadius:14,
                  border:`1px solid ${filterTag===t?(tagColor[t]||LINK):BORDER}`,
                  background:filterTag===t?(tagColor[t]||LINK)+"12":BG,
                  color:filterTag===t?(tagColor[t]||LINK):T2,
                  fontSize:12,cursor:"pointer",fontFamily:"'Lato',sans-serif",
                  fontWeight:filterTag===t?700:400
                }}>{t} ({count})</button>
              );
            })}
          </div>

          {laidOut.length===0?(
            <div style={{textAlign:"center",padding:80,color:T3}}>No papers match this filter.</div>
          ):(
            <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
              {/* GRAPH SVG */}
              <div style={{flex:1,minWidth:0}}>
                <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} style={{background:SURFACE,borderRadius:8,border:`1px solid ${BORDER}`,userSelect:"none",display:"block"}}>
                  <defs>
                    <marker id="arr" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="7" markerHeight="5" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 4 L 0 8 z" fill={T3}/>
                    </marker>
                    <marker id="arr-hl" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="7" markerHeight="5" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 4 L 0 8 z" fill={LINK}/>
                    </marker>
                    <marker id="arr-del" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="7" markerHeight="5" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 4 L 0 8 z" fill="#c5221f"/>
                    </marker>
                  </defs>

                  {/* cluster bubbles */}
                  {Object.entries(clusterCentroids).map(([tag,c])=>(
                    <g key={tag}>
                      <circle cx={c.cx} cy={c.cy} r={c.r} fill={tagColor[tag]||T3} opacity={0.045} stroke={tagColor[tag]||T3} strokeWidth={1} strokeOpacity={0.15} strokeDasharray="5 3"/>
                      <text x={c.cx} y={c.cy-c.r+14} textAnchor="middle" fontSize={10} fontWeight={700} fill={tagColor[tag]||T3} opacity={0.55} fontFamily="Lato,sans-serif">{tag}</text>
                    </g>
                  ))}

                  {/* builds-on arrows (always clickable to delete) */}
                  {filteredPapers.flatMap(p=>p.buildsOn.map(pid=>{
                    const child=laidOut.find(n=>n.id===p.id);
                    const parent=laidOut.find(n=>n.id===pid);
                    if(!child||!parent) return null;
                    const hl=hovered&&(connSet.has(p.id)&&connSet.has(pid));
                    const dim=hovered&&!hl;
                    const dx=parent.x-child.x,dy=parent.y-child.y;
                    const d=Math.sqrt(dx*dx+dy*dy)||1;
                    const ux=dx/d,uy=dy/d;
                    const x1=child.x+ux*20,y1=child.y+uy*20,x2=parent.x-ux*20,y2=parent.y-uy*20;
                    return(
                      <EdgeGroup key={`${p.id}-${pid}`} x1={x1} y1={y1} x2={x2} y2={y2}
                        hl={hl} dim={dim} canDelete={true}
                        onDelete={()=>setPapers(prev=>prev.map(pp=>pp.id===p.id?{...pp,buildsOn:pp.buildsOn.filter(b=>b!==pid)}:pp))}/>
                    );
                  }))}

                  {/* edge drag preview line */}
                  {edgeDragFrom&&edgeDragMouse&&(()=>{
                    const fromNode=laidOut.find(n=>n.id===edgeDragFrom);
                    if(!fromNode) return null;
                    return <line x1={fromNode.x} y1={fromNode.y} x2={edgeDragMouse.x} y2={edgeDragMouse.y}
                      stroke={LINK} strokeWidth={2} strokeDasharray="6 4" opacity={0.6}/>;
                  })()}

                  {/* paper nodes */}
                  {laidOut.map(n=>{
                    const isHov=hovered===n.id;
                    const isSel=selected===n.id;
                    const conn=connSet.has(n.id);
                    const dim=hovered&&!isHov&&!conn;
                    const pc=tagColor[n.tags[0]]||LINK;
                    const isDropTarget=edgeDragFrom&&edgeDragFrom!==n.id&&edgeDragMouse&&Math.sqrt((n.x-edgeDragMouse.x)**2+(n.y-edgeDragMouse.y)**2)<30;
                    return(
                      <g key={n.id}
                        onMouseEnter={()=>setHovered(n.id)}
                        onMouseLeave={()=>setHovered(null)}
                        style={{opacity:dim?0.1:1,transition:"opacity 0.15s"}}>
                        {/* glow */}
                        {(isHov||isDropTarget)&&<circle cx={n.x} cy={n.y} r={24} fill={isDropTarget?LINK:pc} opacity={isDropTarget?0.2:0.08}/>}
                        {isSel&&<circle cx={n.x} cy={n.y} r={22} fill="none" stroke={pc} strokeWidth={2} strokeDasharray="3 2"/>}
                        {/* main node — drag to move */}
                        <circle cx={n.x} cy={n.y} r={(isHov||isDropTarget)?18:16}
                          fill={CARD} stroke={isDropTarget?LINK:pc} strokeWidth={isSel?2.5:isDropTarget?2.5:1.5}
                          onMouseDown={e=>handleNodeDown(e,n.id)}
                          onClick={()=>setSelected(n.id===selected?null:n.id)}
                          style={{cursor:"grab"}}/>
                        <text x={n.x} y={n.y+1} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={700} fill={pc} fontFamily="Lato,sans-serif" style={{pointerEvents:"none"}}>
                          '{String(n.year).slice(-2)}
                        </text>
                        <text x={n.x} y={n.y+30} textAnchor="middle" fontSize={10} fontWeight={isHov?700:400} fill={T1} fontFamily="Lato,sans-serif" style={{pointerEvents:"none"}}>
                          {n.title.length>28?n.title.slice(0,26)+"…":n.title}
                        </text>
                        {n.tags.slice(0,4).map((t,i)=>(
                          <circle key={t} cx={n.x-(n.tags.slice(0,4).length-1)*4+i*8} cy={n.y+40} r={2.5} fill={tagColor[t]||T3} style={{pointerEvents:"none"}}/>
                        ))}
                        {/* connector handle — appears on hover, drag to create edge */}
                        {isHov&&!edgeDragFrom&&(
                          <circle cx={n.x} cy={n.y-20} r={5}
                            fill={LINK} stroke={CARD} strokeWidth={1.5}
                            onMouseDown={e=>handleConnectorDown(e,n.id)}
                            style={{cursor:"crosshair"}}/>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* RIGHT SIDE PANEL — outside the graph */}
              <div style={{width:260,flexShrink:0}}>
                {/* HOVER TOOLTIP */}
                {hovPaper&&hovNode&&!selected&&(
                  <div style={{
                    background:CARD,borderRadius:6,
                    border:`1px solid ${BORDER}`,padding:12,
                    boxShadow:"0 4px 16px rgba(0,0,0,0.08)"
                  }}>
                    <p style={{margin:0,fontSize:13,fontWeight:700,fontFamily:"'Libre Baskerville',serif",lineHeight:1.3}}>{hovPaper.title}</p>
                    <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center"}}>
                      <span style={{fontSize:12,color:LINK,fontWeight:700}}>{hovPaper.year}</span>
                      {hovPaper.arxiv&&<a href={hovPaper.arxiv} target="_blank" rel="noreferrer" style={{fontSize:11,color:GREEN,textDecoration:"none"}}>arXiv ↗</a>}
                    </div>
                  </div>
                )}

                {/* SELECTED DETAIL PANEL */}
                {selPaper&&(
                  <div style={{
                    background:CARD,borderRadius:8,border:`1px solid ${BORDER}`,
                    padding:16,boxShadow:"0 4px 16px rgba(0,0,0,0.06)",
                    maxHeight:H,overflow:"auto"
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <h3 style={{margin:0,fontSize:15,fontWeight:700,fontFamily:"'Libre Baskerville',serif",lineHeight:1.3,flex:1}}>{selPaper.title}</h3>
                      <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",color:T3,cursor:"pointer",fontSize:18,marginLeft:8,lineHeight:1}}>×</button>
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:6,alignItems:"center"}}>
                      <span style={{fontSize:13,color:LINK,fontWeight:700}}>{selPaper.year}</span>
                      {selPaper.arxiv&&<a href={selPaper.arxiv} target="_blank" rel="noreferrer" style={{fontSize:12,color:GREEN,textDecoration:"none"}}>arXiv ↗</a>}
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:8}}>
                      {selPaper.tags.map(t=>(
                        <span key={t} style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,background:(tagColor[t]||T3)+"15",color:tagColor[t]||T3,border:`1px solid ${tagColor[t]||T3}30`}}>{t}</span>
                      ))}
                    </div>
                    {selPaper.note&&(
                      <div style={{marginTop:10}}>
                        <span style={{fontSize:10,fontWeight:700,color:T1,textTransform:"uppercase",letterSpacing:0.5}}>Notes</span>
                        <p style={{margin:"4px 0 0",fontSize:12,color:T1,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{selPaper.note}</p>
                      </div>
                    )}
                    {selPaper.buildsOn.length>0&&(
                      <div style={{marginTop:10}}>
                        <span style={{fontSize:10,fontWeight:700,color:T2,textTransform:"uppercase",letterSpacing:0.5}}>Builds on</span>
                        {selPaper.buildsOn.map(pid=>{const pp=papers.find(p=>p.id===pid);return pp?<p key={pid} style={{margin:"2px 0",fontSize:12,color:LINK,cursor:"pointer"}} onClick={()=>setSelected(pid)}>→ {pp.title} ({pp.year})</p>:null;})}
                      </div>
                    )}
                    {papers.filter(p=>p.buildsOn.includes(selPaper.id)).length>0&&(
                      <div style={{marginTop:8}}>
                        <span style={{fontSize:10,fontWeight:700,color:T2,textTransform:"uppercase",letterSpacing:0.5}}>Built upon by</span>
                        {papers.filter(p=>p.buildsOn.includes(selPaper.id)).map(p=>(
                          <p key={p.id} style={{margin:"2px 0",fontSize:12,color:"#e8710a",cursor:"pointer"}} onClick={()=>setSelected(p.id)}>← {p.title} ({p.year})</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state hint */}
                {!hovPaper&&!selPaper&&(
                  <div style={{padding:16,color:T3,fontSize:12,lineHeight:1.5}}>
                    <p style={{margin:0}}>Hover a node to preview.</p>
                    <p style={{margin:"4px 0 0"}}>Click to see full details, ArXiv link, and citation chain.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <p style={{fontSize:11,color:T3,marginTop:8}}>
            {filteredPapers.length} papers · drag nodes to move · blue dot on hover to connect · click arrows to remove
          </p>
        </div>
      )}

      {/* ═══ PAPERS TAB (Google Scholar-ish) ═══════════════════ */}
      {tab==="papers"&&(
        <div style={{display:"flex",gap:0,height:"100%"}}>
          {/* LEFT — paper list */}
          <div style={{flex:1,overflow:"auto",padding:"20px 24px",borderRight:`1px solid ${BORDER}`}}>
            {[...papers].sort((a,b)=>(b.year||0)-(a.year||0)).map(p=>(
              <div key={p.id}
                onClick={()=>setSelectedPaperId(selectedPaperId===p.id?null:p.id)}
                style={{borderBottom:`1px solid ${BORDER}`,padding:"12px 0",cursor:"pointer",
                  background:selectedPaperId===p.id?SURFACE:"transparent",
                  margin:"0 -12px",paddingLeft:12,paddingRight:12,borderRadius:selectedPaperId===p.id?4:0}}>
                <a href={p.arxiv||"#"} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                  style={{fontSize:15,fontFamily:"'Libre Baskerville',serif",color:LINK,textDecoration:"none",fontWeight:400,lineHeight:1.3,display:"block"}}>{p.title}</a>
                <p style={{margin:"2px 0 0",fontSize:12,color:GREEN,lineHeight:1.4}}>{p.authors||"—"} · {p.year}</p>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:5}}>
                  {p.tags.map(t=>(
                    <span key={t} style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:8,background:(tagColor[t]||T3)+"12",color:tagColor[t]||T3}}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* RIGHT — selected paper note */}
          <div style={{width:340,flexShrink:0,overflow:"auto",padding:"20px 24px"}}>
            {(()=>{
              const sp = papers.find(p=>p.id===selectedPaperId);
              if(!sp) return (
                <div style={{color:T3,fontSize:13,marginTop:40,textAlign:"center",lineHeight:1.6}}>
                  <p style={{margin:0}}>Click a paper to see your notes.</p>
                </div>
              );
              return (
                <div>
                  <h3 style={{margin:0,fontSize:14,fontWeight:700,fontFamily:"'Libre Baskerville',serif",lineHeight:1.3,color:T1}}>{sp.title}</h3>
                  <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center"}}>
                    <span style={{fontSize:12,color:LINK,fontWeight:700}}>{sp.year}</span>
                    {sp.arxiv&&<a href={sp.arxiv} target="_blank" rel="noreferrer" style={{fontSize:11,color:GREEN,textDecoration:"none"}}>arXiv ↗</a>}
                  </div>
                  {sp.buildsOn.length>0&&(
                    <p style={{margin:"8px 0 0",fontSize:11,color:T3}}>
                      Builds on: {sp.buildsOn.map(id=>{const pp=papers.find(x=>x.id===id);return pp?pp.title+" ("+pp.year+")":id;}).join(" · ")}
                    </p>
                  )}
                  <NoteEditor paper={sp} onUpdate={(v)=>setPapers(prev=>prev.map(p=>p.id===sp.id?{...p,note:v}:p))}/>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      </div>

      {/* ═══ ADD PAPER MODAL ══════════════════════════════════ */}
      {showAdd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={()=>setShowAdd(false)}>
          <div style={{background:BG,borderRadius:8,border:`1px solid ${BORDER}`,padding:24,width:500,maxHeight:"85vh",overflow:"auto",boxShadow:"0 12px 40px rgba(0,0,0,0.15)"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:"0 0 16px",fontSize:18,fontWeight:700,fontFamily:"'Libre Baskerville',serif"}}>Add Paper</h3>
            <label style={{fontSize:11,fontWeight:700,color:T2,display:"block",marginBottom:4}}>ArXiv Link</label>
            <div style={{position:"relative",marginBottom:10}}>
              <input value={apArxiv} onChange={e=>setApArxiv(e.target.value)}
                onPaste={e=>fetchArxivMeta(e.clipboardData.getData("text"))}
                placeholder="Paste arXiv link to auto-fill fields…" style={inputSt}/>
              {arxivLoading&&<span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:LINK}}>Loading…</span>}
            </div>
            <label style={{fontSize:11,fontWeight:700,color:T2,display:"block",marginBottom:4}}>Title *</label>
            <input value={apTitle} onChange={e=>setApTitle(e.target.value)} placeholder="Paper title" style={{...inputSt,marginBottom:10}}/>
            <label style={{fontSize:11,fontWeight:700,color:T2,display:"block",marginBottom:4}}>Authors</label>
            <input value={apAuthors} onChange={e=>setApAuthors(e.target.value)} placeholder="e.g. Ryan Greenblatt, Buck Shlegeris, ..." style={{...inputSt,marginBottom:10}}/>

            <label style={{fontSize:11,fontWeight:700,color:T2,display:"block",marginBottom:4}}>Abstract</label>
            <textarea value={apAbstract} onChange={e=>setApAbstract(e.target.value)} rows={3} placeholder="Paste abstract…" style={{...inputSt,resize:"vertical",marginBottom:10}}/>
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              <div style={{flex:1}}>
                <label style={{fontSize:11,fontWeight:700,color:T2,display:"block",marginBottom:4}}>Year</label>
                <input value={apYear} onChange={e=>setApYear(e.target.value)} placeholder="2025" style={inputSt}/>
              </div>
            </div>
            <label style={{fontSize:11,fontWeight:700,color:T2,display:"block",marginBottom:4}}>Notes</label>
            <textarea value={apNote} onChange={e=>setApNote(e.target.value)} rows={3} placeholder="Your notes on this paper..." style={{...inputSt,resize:"vertical",marginBottom:10}}/>

            <label style={{fontSize:11,fontWeight:700,color:T2,display:"block",marginBottom:6}}>Tags</label>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
              {tags.map(t=>{
                const active=apTags.includes(t);
                return(<button key={t} onClick={()=>active?setApTags(prev=>prev.filter(x=>x!==t)):setApTags(prev=>[...prev,t])} style={{
                  padding:"3px 10px",borderRadius:12,border:`1px solid ${active?tagColor[t]||LINK:BORDER}`,
                  background:active?(tagColor[t]||LINK)+"12":BG,color:active?tagColor[t]||LINK:T2,
                  fontSize:11,fontWeight:active?700:400,cursor:"pointer",fontFamily:"'Lato',sans-serif"
                }}>{t}</button>);
              })}
            </div>
            <div style={{display:"flex",gap:6,marginBottom:4}}>
              <input value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addNewTag()} placeholder="New tag…" style={{...inputSt,flex:1}}/>
              <button onClick={addNewTag} disabled={!newTag.trim()} style={{padding:"6px 14px",borderRadius:4,border:`1px solid ${BORDER}`,background:BG,color:T2,fontSize:12,cursor:"pointer",fontFamily:"'Lato',sans-serif"}}>Add</button>
            </div>
            <button onClick={suggestTags} disabled={aiSuggesting||(!apTitle.trim()&&!apNote.trim()&&!apAbstract.trim())} style={{
              padding:"5px 14px",borderRadius:4,border:`1px solid ${LINK}40`,background:LINK+"08",
              color:LINK,fontSize:12,cursor:"pointer",fontFamily:"'Lato',sans-serif",marginTop:4,marginBottom:8
            }}>{aiSuggesting?"Thinking…":"✦ Suggest from my tags"}</button>
            {aiError&&<p style={{fontSize:11,color:"#c5221f",margin:"4px 0 8px"}}>{aiError}</p>}
            {aiSuggestions.length>0&&(
              <div style={{marginBottom:10,padding:10,background:SURFACE,borderRadius:6,border:`1px dashed ${LINK}40`}}>
                <span style={{fontSize:10,color:T2}}>AI suggestions:</span>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
                  {aiSuggestions.map(t=>(
                    <button key={t} onClick={()=>{if(!apTags.includes(t))setApTags(prev=>[...prev,t]);setAiSuggestions(prev=>prev.filter(x=>x!==t));}} style={{
                      padding:"3px 10px",borderRadius:12,border:`1px solid ${LINK}`,
                      background:LINK+"12",color:LINK,fontSize:11,cursor:"pointer",fontFamily:"'Lato',sans-serif"
                    }}>+ {t}</button>
                  ))}
                </div>
              </div>
            )}

            <label style={{fontSize:11,fontWeight:700,color:T2,display:"block",marginBottom:6}}>Builds On</label>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:16}}>
              {papers.map(p=>{
                const active=apBuilds.includes(p.id);
                return(<button key={p.id} onClick={()=>active?setApBuilds(prev=>prev.filter(x=>x!==p.id)):setApBuilds(prev=>[...prev,p.id])} style={{
                  padding:"3px 10px",borderRadius:4,border:`1px solid ${active?GREEN:BORDER}`,
                  background:active?GREEN+"12":BG,color:active?GREEN:T2,
                  fontSize:11,cursor:"pointer",fontFamily:"'Lato',sans-serif"
                }}>{p.title.length>35?p.title.slice(0,33)+"…":p.title} ({p.year})</button>);
              })}
            </div>

            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowAdd(false)} style={{padding:"8px 18px",borderRadius:4,border:`1px solid ${BORDER}`,background:BG,color:T2,fontSize:13,cursor:"pointer",fontFamily:"'Lato',sans-serif"}}>Cancel</button>
              <button onClick={submitPaper} disabled={!apTitle.trim()} style={{padding:"8px 20px",borderRadius:4,border:"none",background:LINK,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Lato',sans-serif",opacity:apTitle.trim()?1:0.4}}>Add to Graph</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
